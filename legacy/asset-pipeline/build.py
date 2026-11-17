"""시트에서 잘라낸 소품 + 직접 그린 대형 설비로 방 배경 PNG와 캐릭터 PNG를 만든다."""
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np
from extract import load

SHEET, BOXES = load()
FB = json.load(open('fboxes.json'))
OUT = 'out'; os.makedirs(OUT, exist_ok=True)
FLOOR_H = 220; WALL_TOP = 30; WALL_BOT = 186; PROP_Y = 193; FEET_Y = 200

def crop(box): 
    im = SHEET.crop(box); bb = im.getbbox(); return im.crop(bb) if bb else im
def up(im, s=2): return im.resize((im.width*s, im.height*s), Image.NEAREST)
def F(i, s=2): return up(crop(FB[i]), s)
def M(box, s=2): return up(crop(box), s)

PROPS = {
 'bed': F(31), 'table': M((684,275,734,308)), 'chair': F(33), 'shelf': F(34), 'pipe': F(35),
 'crate_a': F(36), 'crate_b': F(37), 'crate_green': F(38), 'terminal': F(24), 'locker2': F(26), 'locker_a': F(28), 'locker_b': F(30),
 'console': F(39), 'console2': M((654,322,679,343)), 'pump': M((692,303,712,343)),
 'wcrate1': F(40), 'wcrate2': F(41), 'wcrate3': F(42), 'wcrate4': F(43),
 'barrel_g': F(44), 'barrel_b': F(45), 'barrel_r': F(46), 'vent_a': F(47), 'vent_b': F(49),
 'medkit': F(0), 'ammo1': F(7), 'ammo2': F(8), 'ammo3': F(21), 'ammo4': F(22), 'rifle': F(4), 'radio': F(29),
 'plants': F(19), 'bottle': F(16), 'can1': F(17), 'can2': F(18), 'pack': F(12), 'lamp_item': F(13),
}
wall = SHEET.crop(BOXES[136]).convert('RGB'); tw = wall.width // 4
TILES = [up(wall.crop((i*tw+1, 1, (i+1)*tw-1, wall.height-1))) for i in range(4)]
DOORS = [up(crop(BOXES[i])) for i in (137, 138, 139)]

# ───────── 직접 그리는 대형 설비 (아트 픽셀로 그린 뒤 2배 확대 → 시트 소품과 같은 도트 밀도) ─────────
def shade(col, k): return tuple(max(0, min(255, int(c*k))) for c in col)
class Art:
    def __init__(s, w, h, seed=1): s.im = Image.new('RGBA', (w, h), (0,0,0,0)); s.d = ImageDraw.Draw(s.im); s.rnd = random.Random(seed)
    def rect(s, x, y, w, h, col): s.d.rectangle([x, y, x+w-1, y+h-1], fill=tuple(col)+(255,))
    def box(s, x, y, w, h, col, ol=(22,24,26)):
        s.rect(x-1, y-1, w+2, h+2, ol); s.rect(x, y, w, h, col)
        s.rect(x, y, w, 1, shade(col, 1.25)); s.rect(x, y, 1, h, shade(col, 1.12)); s.rect(x+w-1, y, 1, h, shade(col, .72)); s.rect(x, y+h-1, w, 1, shade(col, .62))
    def cyl(s, x, y, w, h, col, ol=(22,24,26)):  # 세로 원통: 가로 방향 명암
        s.rect(x-1, y-1, w+2, h+2, ol)
        for i in range(w):
            t = i/(w-1); k = 0.62 + 0.75*max(0, 1-abs(t-0.3)*1.9)
            s.rect(x+i, y, 1, h, shade(col, min(k, 1.3)))
    def grime(s, dens=0.10, rust=0.03):
        a = np.array(s.im).astype(int); r = np.random.RandomState(s.rnd.randint(0, 9999))
        m = a[:,:,3] > 0; n = r.rand(*m.shape)
        for c in range(3): a[:,:,c] = np.where(m & (n < dens), a[:,:,c]*0.86, a[:,:,c])
        n2 = r.rand(*m.shape); rm = m & (n2 < rust)
        a[:,:,0] = np.where(rm, a[:,:,0]*0.6+110*0.4, a[:,:,0]); a[:,:,1] = np.where(rm, a[:,:,1]*0.6+62*0.4, a[:,:,1]); a[:,:,2] = np.where(rm, a[:,:,2]*0.6+36*0.4, a[:,:,2])
        # 아래로 흐르는 녹물 자국
        for _ in range(int(m.shape[1]*0.12)):
            x = r.randint(0, m.shape[1]); y = r.randint(0, max(1, m.shape[0]-8))
            for k in range(r.randint(3, 8)):
                if y+k < m.shape[0] and m[y+k, x]: a[y+k, x, :3] = a[y+k, x, :3]*0.7 + np.array([96,56,34])*0.3
        s.im = Image.fromarray(a.clip(0,255).astype(np.uint8), 'RGBA'); s.d = ImageDraw.Draw(s.im)
    def done(s): return up(s.im)

OLIVE=(92,98,74); STEEL=(112,118,120); DARK=(52,56,58); RED=(150,48,40); YEL=(196,160,56); BLUE=(70,104,128)
def generator():
    a = Art(78, 62, 3)
    a.cyl(54, 0, 6, 16, (86,90,92)); a.rect(52, 6, 10, 2, (40,42,44))                      # 배기관
    a.box(6, 10, 34, 12, RED); a.rect(18, 8, 8, 2, (40,42,44)); a.rect(9, 13, 12, 1, (214,200,170)) # 연료 탱크
    a.box(2, 23, 74, 30, OLIVE)                                                            # 본체
    a.box(5, 27, 26, 20, DARK)
    for y in range(29, 46, 3): a.rect(7, y, 22, 1, (104,108,104))                          # 방열 그릴
    a.box(34, 26, 18, 14, (62,66,68)); a.rect(36, 28, 14, 6, (18,34,28)); a.rect(37, 29, 7, 1, (110,220,140)); a.rect(37, 31, 10, 1, (70,160,100))
    for i, c in enumerate([(200,60,50), (220,180,60), (90,200,110)]): a.rect(36+i*5, 36, 3, 2, c)
    a.d.ellipse([56, 27, 68, 39], fill=(22,24,26,255)); a.d.ellipse([57, 28, 67, 38], fill=(206,202,186,255)); a.d.line([62, 33, 65, 30], fill=(190,50,40,255))
    a.box(56, 42, 16, 7, (62,66,68)); a.rect(58, 44, 4, 3, (200,60,50)); a.rect(64, 44, 6, 1, (150,154,150))
    a.box(34, 43, 18, 6, DARK); a.rect(36, 45, 14, 1, (120,124,120))
    for x in range(2, 76, 6): a.rect(x, 50, 3, 3, YEL); a.rect(x+3, 50, 3, 3, (30,30,28))  # 경고 줄무늬
    a.box(0, 54, 78, 5, (60,62,62)); a.rect(6, 59, 8, 3, (30,32,34)); a.rect(64, 59, 8, 3, (30,32,34))
    a.grime(); return a.done()
def tank():
    a = Art(40, 76, 5)
    a.cyl(15, 0, 6, 8, (96,100,102)); a.rect(12, 6, 12, 2, (44,46,48))
    a.cyl(2, 9, 36, 58, BLUE)
    for y in (9, 26, 44, 62): a.rect(1, y, 38, 3, (38,54,66)); a.rect(2, y, 36, 1, (126,150,164))
    for y in (10, 27, 45, 63):
        for x in range(4, 37, 5): a.rect(x, y+1, 1, 1, (160,176,184))
    a.rect(24, 14, 8, 44, (20,22,24)); a.rect(25, 15, 6, 42, (14,32,42)); a.rect(25, 32, 6, 25, (72,170,196)); a.rect(25, 32, 6, 1, (170,230,240)); a.rect(26, 38, 1, 2, (170,230,240)); a.rect(29, 46, 1, 2, (170,230,240))
    a.rect(8, 30, 9, 7, (196,160,56)); a.rect(9, 31, 7, 5, (30,30,28)); a.rect(11, 32, 3, 2, (196,160,56))
    a.rect(5, 67, 5, 9, (40,42,44)); a.rect(30, 67, 5, 9, (40,42,44)); a.rect(3, 74, 34, 2, (54,56,58))
    a.grime(0.12, 0.05); return a.done()
def filters():
    a = Art(46, 52, 7)
    a.rect(4, 4, 38, 3, (44,46,48)); a.rect(4, 4, 38, 1, (150,154,152))
    for i, band in enumerate([(72,170,196), (110,190,110), (196,160,56)]):
        x = 3 + i*14
        a.rect(x+4, 6, 3, 5, (60,62,64)); a.cyl(x, 11, 11, 34, STEEL); a.rect(x-1, 20, 13, 4, (34,36,38)); a.rect(x+1, 21, 9, 2, band)
        a.rect(x-1, 36, 13, 2, (58,62,64)); a.rect(x+2, 45, 7, 5, (40,42,44))
    a.rect(0, 50, 46, 2, (54,56,58)); a.d.ellipse([36, 0, 44, 8], fill=(22,24,26,255)); a.d.ellipse([37, 1, 43, 7], fill=(206,202,186,255)); a.d.line([40, 4, 42, 2], fill=(190,50,40,255))
    a.grime(); return a.done()
def growrack(w=70):
    a = Art(w, 78, 9)
    for x in (0, w//2-1, w-3): a.rect(x, 0, 3, 78, (46,48,48)); a.rect(x, 0, 1, 78, (104,108,104))
    for y in (22, 46, 70):
        a.rect(1, y-19, w-2, 2, (36,38,38)); a.rect(3, y-17, w-6, 1, (226,255,196)); a.rect(3, y-16, w-6, 1, (150,220,120))  # 재배등
        a.box(1, y, w-2, 5, (74,80,70)); a.rect(3, y+1, w-6, 2, (44,62,48)); a.rect(2, y+6, w-4, 1, (52,84,104))
    a.grime(0.06, 0.02); im = a.done()
    pl = PROPS['plants'].crop((0, 0, PROPS['plants'].width, PROPS['plants'].height-10))
    for y in (22, 46, 70):
        x = 6
        while x + pl.width < w*2 - 4: im.alpha_composite(pl, (x, y*2 - pl.height + 2)); x += pl.width - 4
    return im
def toolboard():
    a = Art(52, 26, 11); a.box(1, 1, 50, 24, (88,68,46))
    for i in range(7):
        x = 5+i*7; a.rect(x, 5, 1, 12+(i%3)*2, (160,164,160)); a.rect(x-1, 4, 3, 3, [(120,70,44),(90,94,96),(150,48,40)][i%3])
    a.rect(4, 21, 44, 1, (60,46,30)); a.grime(0.08, 0.02); return a.done()
def ivstand():
    a = Art(10, 46, 13); a.rect(4, 2, 1, 42, (150,154,152)); a.rect(1, 2, 8, 1, (150,154,152)); a.box(1, 4, 4, 8, (190,220,226)); a.rect(2, 12, 1, 10, (150,200,210)); a.rect(1, 44, 8, 2, (60,62,64)); return a.done()
def gunrack():
    a = Art(64, 30, 15); a.box(1, 1, 62, 28, (54,58,56))
    im = a.done(); rf = crop(FB[4])
    for i in range(3): im.alpha_composite(rf.resize((int(rf.width*1.5), int(rf.height*1.5)), Image.NEAREST), (8, 6+i*17))
    return im
def bunk():
    b = PROPS['bed']; im = Image.new('RGBA', (b.width+8, b.height*2+14), (0,0,0,0)); d = ImageDraw.Draw(im)
    for x in (0, b.width+2): d.rectangle([x, 0, x+5, im.height-1], fill=(40,42,44,255)); d.rectangle([x, 0, x+1, im.height-1], fill=(108,112,108,255))
    im.alpha_composite(b, (4, 6)); im.alpha_composite(b, (4, b.height+14)); return im
PROPS.update(generator=generator(), tank=tank(), filters=filters(), growrack=growrack(), toolboard=toolboard(), ivstand=ivstand(), gunrack=gunrack(), bunk=bunk())

# ───────── 방 배경 ─────────
def noise_fill(w, h, col, amp, seed):
    r = np.random.RandomState(seed); n = (r.rand(h//2+1, w//2+1)-0.5)*amp
    n = np.kron(n, np.ones((2,2)))[:h, :w]
    a = np.clip(np.array(col)[None,None,:] + n[:,:,None], 0, 255).astype(np.uint8); return Image.fromarray(a, 'RGB').convert('RGBA')
def room(w, tile_ids, props, lamps, seed, light=(255,196,120), sign=None, wall_items=()):
    im = Image.new('RGBA', (w, FLOOR_H), (20,22,24,255)); d = ImageDraw.Draw(im)
    # 벽 윗단(콘크리트 보) + 타일 벽
    im.alpha_composite(noise_fill(w, 30, (74,78,74), 12, seed), (0, WALL_TOP))
    th = WALL_BOT - (WALL_TOP+26); x = 0; i = 0
    while x < w:
        t = TILES[tile_ids[i % len(tile_ids)]].resize((112, th), Image.NEAREST); im.alpha_composite(t.convert('RGBA'), (x, WALL_TOP+26)); x += 112; i += 1
    d.rectangle([0, WALL_TOP+24, w, WALL_TOP+27], fill=(34,36,36,255)); d.rectangle([0, WALL_TOP+24, w, WALL_TOP+24], fill=(120,124,116,255))
    for x in range(112, w, 112):  # 타일 이음매를 가리는 철제 보강대
        d.rectangle([x-4, WALL_TOP+26, x+3, WALL_BOT], fill=(48,50,50,255)); d.rectangle([x-4, WALL_TOP+26, x-3, WALL_BOT], fill=(118,122,116,255))
        for y in range(WALL_TOP+36, WALL_BOT, 22): d.rectangle([x-1, y, x, y+1], fill=(140,144,136,255))
    # 벽 걸레받이 그늘
    d.rectangle([0, WALL_BOT-10, w, WALL_BOT], fill=(40,42,40,255)); d.rectangle([0, WALL_BOT-10, w, WALL_BOT-9], fill=(92,96,88,255))
    # 천장 슬래브 + 배관 + 전선
    im.alpha_composite(noise_fill(w, 14, (40,42,42), 8, seed+1), (0, 0)); d.rectangle([0, 12, w, 13], fill=(14,15,16,255))
    d.rectangle([0, 16, w, 23], fill=(86,90,88,255)); d.rectangle([0, 16, w, 17], fill=(150,154,146,255)); d.rectangle([0, 22, w, 23], fill=(44,46,46,255))
    for x in range(26, w, 58): d.rectangle([x, 14, x+5, 25], fill=(50,52,52,255)); d.rectangle([x, 14, x+1, 25], fill=(128,132,124,255))
    d.rectangle([0, 26, w, 28], fill=(112,70,44,255)); d.rectangle([0, 26, w, 26], fill=(160,104,66,255))
    r = random.Random(seed)
    for x in range(40, w-40, 150):
        pts = [(x+i*6, 30+int(7*(1-((i-7)/7)**2))) for i in range(15)]; d.line(pts, fill=(16,16,18,255), width=2)
    # 바닥
    fl = noise_fill(w, 20, (96,98,90), 14, seed+2); im.alpha_composite(fl, (0, WALL_BOT))
    for x in range(-40, w+40, 44): d.line([(x, WALL_BOT), (x-14, WALL_BOT+19)], fill=(70,72,66,255))
    d.rectangle([0, WALL_BOT, w, WALL_BOT+1], fill=(30,32,30,255)); d.rectangle([0, WALL_BOT+9, w, WALL_BOT+9], fill=(78,80,74,255))
    im.alpha_composite(noise_fill(w, 16, (46,48,48), 8, seed+3), (0, FLOOR_H-16)); d.rectangle([0, FLOOR_H-16, w, FLOOR_H-15], fill=(150,154,146,255)); d.rectangle([0, FLOOR_H-2, w, FLOOR_H], fill=(12,13,14,255))
    for x in range(8, w, 26): d.rectangle([x, FLOOR_H-10, x+1, FLOOR_H-9], fill=(96,100,96,255))
    # 벽 장식 / 표지판
    for name, x, y in wall_items: im.alpha_composite(PROPS[name], (x, y))
    if sign: 
        sx, sy, txt, col = sign; tw_ = int(d.textlength(txt)); d.rectangle([sx, sy, sx+tw_+9, sy+13], fill=(28,30,30,255)); d.rectangle([sx+1, sy+1, sx+tw_+8, sy+12], fill=col); d.text((sx+5, sy+1), txt, fill=(24,24,22,255))
    # 소품 (바닥에 그림자)
    for name, x in props:
        p = PROPS[name]; sh = Image.new('RGBA', (p.width+10, 8), (0,0,0,0)); ImageDraw.Draw(sh).ellipse([0, 0, p.width+9, 7], fill=(0,0,0,110)); im.alpha_composite(sh, (max(0, x-5), PROP_Y-4))
        im.alpha_composite(p, (x, PROP_Y - p.height))
    # 양쪽 기둥
    for x in (0, w-8): d.rectangle([x, 0, x+7, FLOOR_H-1], fill=(58,60,60,255)); d.rectangle([x, 0, x+1, FLOOR_H-1], fill=(138,142,134,255)); d.rectangle([x+6, 0, x+7, FLOOR_H-1], fill=(24,25,26,255))
    # 조명: 전체를 살짝 어둡게 → 등 아래를 따뜻하게
    base = np.array(im.convert('RGB')).astype(float); yy, xx = np.mgrid[0:FLOOR_H, 0:w]
    lit = np.full((FLOOR_H, w), 0.62)
    for lx in lamps:
        dx = (xx-lx)/ (70 + (yy-30)*0.55).clip(40, None); cone = np.exp(-(dx**2)*1.6) * np.clip(1-(yy-28)/260, 0.35, 1) * (yy > 26)
        lit = np.maximum(lit, 0.62 + 0.62*cone)
    tint = np.array(light)/255.0
    out = base * lit[:,:,None] * (0.78 + 0.22*tint[None,None,:]*np.clip(lit[:,:,None]-0.5, 0, 1)*2)
    out = np.clip(out, 0, 255).astype(np.uint8); im = Image.fromarray(out, 'RGB').convert('RGBA'); d = ImageDraw.Draw(im)
    for lx in lamps:
        d.rectangle([lx-17, 28, lx+17, 30], fill=(40,42,42,255)); d.rectangle([lx-15, 31, lx+15, 34], fill=(255,240,196,255)); d.rectangle([lx-10, 31, lx+10, 32], fill=(255,252,236,255))
    return im

RW = 540; L3 = [96, 270, 444]
ROOMS = {
 'power_plant': room(RW, [0,1], [('generator', 22), ('terminal', 200), ('console', 262), ('barrel_r', 332), ('barrel_g', 376), ('pump', 424), ('wcrate1', 484)], L3, 1, (255,176,96), (206, 70, 'DANGER', (196,160,56,255)), [('vent_b', 300, 62), ('vent_a', 430, 64)]),
 'water_purifier': room(RW, [3,2], [('tank', 22), ('filters', 118), ('pump', 230), ('pipe', 280), ('tank', 332), ('barrel_b', 432), ('console2', 478)], L3, 2, (190,226,255), (232, 66, 'WATER', (110,170,196,255))),
 'farm': room(RW, [2,2], [('growrack', 18), ('growrack', 164), ('growrack', 310), ('crate_a', 462), ('wcrate2', 500)], L3, 3, (214,255,176)),
 'dormitory': room(RW, [2,3], [('bunk', 18), ('bunk', 150), ('locker2', 286), ('locker_a', 342), ('table', 382), ('chair', 492)], L3, 4, (255,206,140), None, [('vent_a', 400, 62)]),
 'medical': room(RW, [3,3], [('bed', 18), ('ivstand', 136), ('bed', 170), ('ivstand', 288), ('terminal', 322), ('locker_b', 386), ('shelf', 422), ('medkit', 492)], L3, 5, (226,240,255), (40, 62, 'MEDICAL', (190,196,190,255))),
 'workshop': room(RW, [0,2], [('table', 18), ('wcrate1', 124), ('wcrate2', 158), ('console2', 200), ('console', 262), ('shelf', 332), ('crate_green', 414), ('barrel_g', 464), ('wcrate3', 504)], L3, 6, (255,190,120), None, [('toolboard', 18, 66), ('toolboard', 330, 66)]),
 'laboratory': room(RW, [3,2], [('terminal', 22), ('terminal', 78), ('table', 142), ('radio', 164), ('console', 264), ('locker2', 330), ('shelf', 396), ('barrel_g', 480)], L3, 7, (176,232,255), (150, 62, 'SECTOR B-3', (190,196,190,255))),
 'armory': room(RW, [1,0], [('locker2', 20), ('locker_a', 76), ('locker_b', 108), ('ammo1', 160), ('ammo3', 210), ('crate_green', 262), ('ammo2', 322), ('wcrate3', 392), ('barrel_g', 440), ('barrel_r', 482)], L3, 8, (255,236,190), (400, 62, 'ARMORY', (196,160,56,255)), [('gunrack', 170, 64)]),
}
ROOMS['radio_fix'] = None; del ROOMS['radio_fix']
for k, v in ROOMS.items(): v.save(f'{OUT}/room-{k}.png')

# ───────── 캐릭터 ─────────
def char(i, scale=0.8):
    c = crop(BOXES[i]); c = c.resize((round(c.width*scale), round(c.height*scale)), Image.LANCZOS)
    a = np.array(c).astype(int); gd = a[:,:,1]-np.maximum(a[:,:,0],a[:,:,2]); a[:,:,3] = np.where((a[:,:,3] > 110) & ~((gd > 22) & (a[:,:,1] > 105)), 255, 0); a = a.astype(np.uint8); return Image.fromarray(a, 'RGBA')
CHARS = {'c_woman1': 1, 'c_woman2': 3, 'c_man_red': 6, 'c_elder': 8, 'c_strong': 9, 'c_bald': 10, 'c_big': 11, 'c_hijab': 12, 'c_beard': 13, 'c_glasses': 14, 'z1': 42, 'z2': 43, 'z3': 44, 'z4': 45, 'dog': 51}
CH = {k: char(i) for k, i in CHARS.items()}
for k, v in CH.items(): v.save(f'{OUT}/{k}.png')
print({k: v.size for k, v in CH.items()})
