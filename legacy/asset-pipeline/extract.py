import sys, json
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as ndi
SRC='source-sheet.png'
def load():
    im=Image.open(SRC).convert('RGB'); a=np.array(im).astype(float)
    bg=np.array([144,230,45.]); d=np.abs(a-bg).sum(axis=2)
    m=np.maximum(a[:,:,0],a[:,:,2]); g=a[:,:,1]-m
    bgmask=(d<90)|((g>40)&(a[:,:,1]>140))
    fg=~bgmask
    # 배경과 맞닿은 가장자리 한 겹 제거 + 초록 번짐 억제
    keep=ndi.binary_erosion(fg,iterations=1)
    a2=a.copy(); spill=(a[:,:,1]>m+6)&(g>12)&ndi.binary_dilation(bgmask,iterations=3)
    a2[:,:,1]=np.where(spill,m,a[:,:,1])
    rgba=np.dstack([a2.clip(0,255).astype(np.uint8),(keep*255).astype(np.uint8)])
    lab,n=ndi.label(ndi.binary_dilation(fg,iterations=2))
    boxes=[]
    for s in ndi.find_objects(lab):
        y0,y1,x0,x1=s[0].start,s[0].stop,s[1].start,s[1].stop
        if x1-x0>=8 and y1-y0>=8: boxes.append((max(0,x0+1),max(0,y0+1),x1-1,y1-1))
    boxes.sort(key=lambda b:(b[1]//40,b[0]))
    return Image.fromarray(rgba,'RGBA'),boxes
if __name__=='__main__':
    img,boxes=load(); json.dump(boxes,open('boxes.json','w'))
    sc=2; prev=Image.new('RGBA',(img.width*sc,img.height*sc),(40,44,52,255)); prev.alpha_composite(img.resize(prev.size,Image.NEAREST))
    d=ImageDraw.Draw(prev)
    for i,b in enumerate(boxes):
        d.rectangle([b[0]*sc,b[1]*sc,b[2]*sc,b[3]*sc],outline=(255,80,80,255)); d.text((b[0]*sc+2,b[1]*sc+1),str(i),fill=(255,255,0,255))
    prev.crop((0,0,1200,1118)).save('idx_left.png'); prev.crop((1150,0,2048,1118)).save('idx_right.png'); print(len(boxes))
