"""Deterministic native SVG artwork for Chauá Educa. No runtime drawing dependency."""
from pathlib import Path
import math, random, json, base64
ROOT=Path(__file__).resolve().parents[1]/'art/v2'
SVG=ROOT/'svg';SVG.mkdir(parents=True,exist_ok=True)
for folder in ['png','review']:(ROOT/folder).mkdir(parents=True,exist_ok=True)

def path(d,fill,extra=''): return f'<path d="{d}" fill="{fill}" {extra}/>'
def ellipse(x,y,rx,ry,fill,extra=''): return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" {extra}/>'
def wrap(body,w,h,defs='',label=''):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>{label}</title><defs>{defs}</defs>{body}</svg>'
def save(name,body,w,h,defs='',label=''):
 s=wrap(body,w,h,defs,label);(SVG/f'{name}.svg').write_text(s, encoding='utf-8');return s

def grad(id,a,b,x2='0%',y2='100%'):
 return f'<linearGradient id="{id}" x1="0%" y1="0%" x2="{x2}" y2="{y2}"><stop stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
BDEFS=grad('body','#a8d766','#348955','90%','80%')+grad('wing','#73c36b','#176459','90%','100%')+grad('cheek','#75bbca','#437cbb','0%','100%')+grad('crown','#f58c5d','#d95444','70%','90%')+grad('beak','#69797b','#283e46','60%','80%')
def wing(angle,far=False):
 # A fixed shoulder and feather fan; only wing joint angle changes between frames.
 s=path('M 0 0 C -8 -48 -57 -93 -105 -110 Q -108 -100 -96 -85 L -120 -99 Q -125 -87 -102 -69 L -126 -79 Q -129 -64 -102 -49 L -122 -54 Q -123 -39 -95 -28 L -111 -27 Q -110 -13 -80 -9 C -52 8 -22 18 0 0', '#286f61' if far else 'url(#wing)')
 s+=path('M -2 -5 C -16 -41 -48 -68 -87 -85 C -77 -48 -49 -15 -2 -5','#99d772' if not far else '#40816b')
 s+=path('M -27 -23 Q -51 -30 -76 -55 Q -77 -44 -67 -33 L -48 -12 Z','#e97554' if not far else '#ad6e55')
 for i in range(4):
  s+=path(f'M {-25-i*13} {-6-i*12} Q {-52-i*13} {-9-i*12} {-74-i*9} {-25-i*13}','none', 'stroke="#205e54" stroke-width="2" opacity=".35" stroke-linecap="round"')
 return f'<g transform="translate({176 if not far else 190} {172 if not far else 163}) rotate({angle})" {"opacity="+chr(34)+".76"+chr(34) if far else ""}>{s}</g>'
def bird(angle):
 s=wing(angle+14,True)
 # Short Amazon-parrot tail, not a macaw's long tail.
 s+=path('M 131 180 L 52 195 Q 50 204 65 205 L 55 212 Q 59 222 74 218 L 68 224 Q 80 232 96 222 L 145 205 Z','#24745b')
 s+=path('M 55 197 L 69 202 L 63 211 L 78 210 L 75 220 L 98 215 L 87 226 Q 75 233 68 224 L 74 218 Q 60 225 55 212 L 65 205 Q 52 205 55 197','#b2ce6f')
 s+=path('M 86 197 L 95 195 L 110 211 L 101 216 Z','#d77b4d')
 s+=path('M 111 174 C 124 142 173 140 200 147 C 215 114 244 119 257 147 C 271 177 249 207 225 218 C 184 241 136 218 111 198 Z','url(#body)')
 s+=path('M 127 199 Q 174 233 220 210 Q 198 237 156 219 Z','#347c58', 'opacity=".6"')
 s+=ellipse(234,145,41,43,'#7dc27a')
 s+=path('M 209 133 C 209 106 248 90 269 122 L 256 128 Q 240 112 221 132 Z','url(#crown)')
 s+=path('M 214 146 C 225 132 252 133 268 147 C 262 174 244 190 225 177 Q 210 165 214 146','url(#cheek)')
 s+=path('M 247 129 Q 271 119 281 140 L 271 160 Q 254 151 247 149 Z','#efd287')
 s+=path('M 270 136 C 291 131 307 146 307 159 Q 304 176 289 181 L 290 162 Q 282 159 270 157 Z','url(#beak)')
 s+=path('M 272 157 L 290 161 Q 289 173 278 175 Z','#344e56')
 s+=path('M 275 140 Q 293 138 300 152','none','stroke="#a9b9af" stroke-width="3" stroke-linecap="round"')
 s+=ellipse(281,144,2,1.7,'#344c50')
 s+=ellipse(253,143,10.5,11.5,'#f7efd2')+ellipse(256,144,6.3,7.1,'#614d32')+ellipse(257,144,4,5.4,'#213e3e')+ellipse(259,141,2.1,2.3,'#ffffff')
 s+=path('M 240 128 Q 251 122 261 128','none','stroke="#a64b3e" stroke-width="3.5" stroke-linecap="round"')
 s+=path('M 220 166 Q 230 175 242 173','none','stroke="#2e699b" stroke-width="2" opacity=".45"')
 # Tucked feet and soft breast feather accents.
 s+=path('M 188 216 L 194 224 L 206 223 M 199 216 L 205 222 L 216 219','none','stroke="#748a7e" stroke-width="5" stroke-linecap="round"')
 for x,y in [(210,194),(218,188),(201,202)]:s+=path(f'M {x-4} {y} q 4 5 8 0','none','stroke="#d0e7a0" stroke-width="2" opacity=".6"')
 s+=wing(angle)
 s+=ellipse(169,173,14,10,'#8ac975','transform="rotate(26 169 173)"')
 return s
ANGLES=[30,0,-45,-85,-110,-75,-25,10]
for i,a in enumerate(ANGLES):save(f'chaua-flight-{i:02}',bird(a),320,320,BDEFS,f'Chauá, pose de voo {i+1}')
save('chaua-hero',bird(-25),320,320,BDEFS,'Chauá: ilustração de personagem')
# A 4 x 2 sheet, 320 px cells. Fixed origin: head/body do not wobble.
sheet=''.join(f'<g transform="translate({i%4*320} {i//4*320})">{bird(a)}</g>' for i,a in enumerate(ANGLES))
save('chaua-flight-sheet',sheet,1280,640,BDEFS,'Ciclo de voo do chauá em oito poses')

FDEFS=grad('guava','#cce779','#75af59','100%','100%')+grad('mango','#f9d86a','#ed8750','80%','95%')+grad('papaya','#f5cd60','#eda35e','80%','95%')+grad('banana','#ffe292','#e8b848','80%','95%')+grad('seed','#b97a4f','#794c3f','85%','95%')+grad('coconut','#d9c580','#9fa465','90%','95%')+grad('corn','#fbe297','#e4b647','75%','95%')
def leaf(x,y,angle=0,scale=1,color='#4d9b65'):
 return f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})">'+path('M 0 0 Q -5 -25 27 -33 Q 31 -8 0 0',color)+path('M 1 -1 L 23 -28','none','stroke="#b0cc79" stroke-width="1.5" opacity=".65"')+'</g>'
def fruit(kind):
 s=''
 if kind=='Goiaba':
  s+=ellipse(119,143,64,67,'url(#guava)')+ellipse(95,130,21,36,'#e1ed9d','opacity=".35"')
  s+=path('M 117 81 Q 119 65 130 59','none','stroke="#796e42" stroke-width="7" stroke-linecap="round"')+leaf(123,78,24,1.4)
  s+=ellipse(170,169,52,52,'#d5e795')+ellipse(170,169,45,45,'#ed9586')+ellipse(170,169,34,34,'#f4b49a')
  for i in range(12):
   a=i*math.tau/12;s+=ellipse(round(170+23*math.cos(a),2),round(169+23*math.sin(a),2),2.4,3.2,'#fff1cd',f'transform="rotate({i*30} 170 169)"')
  s+=ellipse(170,169,6,7,'#e99b87')
 elif kind=='Manga':
  s+=path('M 127 77 C 164 61 199 90 192 135 C 186 174 142 210 103 207 C 70 202 69 170 80 145 C 93 120 92 89 127 77 Z','url(#mango)')
  s+=path('M 136 82 C 176 79 186 103 180 135 Q 171 167 148 183 Q 191 122 136 82','#e77754','opacity=".7"')
  s+=path('M 99 122 Q 107 95 129 94','none','stroke="#fff0a4" stroke-width="9" stroke-linecap="round" opacity=".7"')
  s+=path('M 136 80 Q 132 61 141 54','none','stroke="#7e7850" stroke-width="6" stroke-linecap="round"')+leaf(136,69,56,1.6)
 elif kind=='Mamao':
  s+=path('M 111 63 C 143 61 139 99 160 122 C 183 151 168 214 128 220 C 87 223 62 192 71 155 C 80 121 86 65 111 63 Z','url(#papaya)')
  s+=path('M 109 73 Q 99 105 90 142','none','stroke="#ffe59b" stroke-width="8" stroke-linecap="round"')
  s+=path('M 149 99 C 176 99 193 142 195 176 C 199 214 175 230 147 221 C 122 213 122 184 127 162 Q 136 113 149 99',' #f6d77b')
  s+=path('M 149 113 C 167 112 183 153 183 178 Q 185 213 151 210 Q 130 205 139 166 Z','#ee925f')
  s+=ellipse(158,172,15,32,'#a45e49')
  for i in range(15):s+=ellipse(150+(i%3)*7+(i%2)*1.5,150+(i//3)*10,3.5,4,'#3c4c44')
  s+=path('M 113 66 L 114 53','none','stroke="#5f8050" stroke-width="6" stroke-linecap="round"')+leaf(114,64,-10,.8)
 elif kind=='Semente':
  s+=path('M 85 173 C 70 144 97 112 150 76 C 195 119 193 171 164 195 C 133 216 99 201 85 173 Z','url(#seed)')
  s+=path('M 150 82 C 119 121 106 163 126 193','none','stroke="#dfb284" stroke-width="6" stroke-linecap="round"')
  s+=path('M 158 91 C 179 120 181 152 167 176','none','stroke="#d7a775" stroke-width="4" stroke-linecap="round" opacity=".45"')
  s+=leaf(151,82,-33,1.15)+leaf(151,82,47,1.25,'#7ab774')
 elif kind=='Coquinho':
  s+=ellipse(118,144,62,66,'url(#coconut)')
  for i in range(4):s+=path(f'M {94+i*13} 85 Q {70+i*21} 145 {98+i*10} 204','none','stroke="#8e975a" stroke-width="2" opacity=".4"')
  s+=path('M 120 80 L 124 66','none','stroke="#7b784b" stroke-width="6" stroke-linecap="round"')
  s+=ellipse(170,178,49,43,'#8a6350','transform="rotate(-24 170 178)"')+ellipse(170,172,44,36,'#eee7cb','transform="rotate(-24 170 172)"')+ellipse(170,172,31,25,'#b9ac7a','transform="rotate(-24 170 172)"')+ellipse(170,174,27,21,'#ddd5af','transform="rotate(-24 170 174)"')
 elif kind=='Banana':
  s+=path('M 72 83 C 78 158 133 192 194 137 L 202 150 C 144 237 55 203 54 100 Z','url(#banana)')
  s+=path('M 91 77 C 102 144 149 167 202 116 L 213 128 C 159 205 75 176 75 88 Z','#f6d478')
  s+=path('M 111 73 C 127 125 166 133 204 91 L 217 102 C 177 166 111 153 96 85 Z','#ffe395')
  s+=path('M 79 104 Q 98 192 184 154 M 101 94 Q 131 156 193 130','none','stroke="#bf963c" stroke-width="2.5" opacity=".5" stroke-linecap="round"')
  s+=path('M 66 100 L 78 69 L 104 64 L 115 76 L 94 88 Z','#6b8756')
  for x,y in [(199,143),(209,122),(211,96)]:s+=path(f'M {x-3} {y-4} l 7 -3 l 4 8 l -6 2 Z','#706e40')
 elif kind=='Milho':
  s+=ellipse(133,135,40,78,'url(#corn)','transform="rotate(12 133 135)"')
  for row in range(9):
   for col in range(4):
    x=111+col*13;y=82+row*13
    if (row in (0,8) and col in (0,3)):continue
    s+=f'<rect x="{x}" y="{y}" width="10" height="10" rx="4" fill="{["#ffe7a3","#f5d16c","#f7d778"][col%3]}" transform="rotate(12 133 135)"/>'
  s+=path('M 123 221 C 83 195 66 141 78 109 Q 108 139 132 187 C 150 149 172 132 199 123 Q 188 182 141 222 Z','#4e9c66')
  s+=path('M 128 216 Q 101 179 90 137 M 142 212 Q 166 178 184 148','none','stroke="#a3c979" stroke-width="3" stroke-linecap="round"')
  s+=path('M 126 62 Q 137 40 141 58 M 134 60 Q 151 38 149 61','none','stroke="#d4ba77" stroke-width="2.5"')
 return s
FRUITS=['Goiaba','Semente','Manga','Mamao','Coquinho','Banana','Milho']
for kind in FRUITS:save(f'fruit-{kind}',fruit(kind),256,256,FDEFS,kind)

# Tropical plant details.
def bromelia(x,y,scale=1):
 s=''
 for a,c in [(-65,'#347c65'),(-38,'#4d9b6c'),(0,'#75b678'),(32,'#4e9a68'),(65,'#286d60')]:
  s+=f'<g transform="rotate({a})">'+path('M 0 0 Q -22 -38 -7 -85 Q 12 -48 0 0',c)+'</g>'
 for a,c in [(-28,'#e68d65'),(0,'#f3ae6d'),(28,'#cf6d59')]:s+=f'<g transform="rotate({a})">'+path('M 0 -9 Q -13 -42 0 -62 Q 12 -37 0 -9',c)+'</g>'
 return f'<g transform="translate({x} {y}) scale({scale})">{s}</g>'
def fern(x,y,scale=1,angle=0,color='#448866'):
 s=path('M 0 0 Q -9 -50 10 -111','none',f'stroke="{color}" stroke-width="3"')
 for i in range(8):
  yy=-10-i*12; xx=-4+((i-3)**2)*.25
  s+=path(f'M {xx} {yy} Q {-31+i*2} {yy-2} {-33+i*2} {yy-20} Q {-6+i} {yy-14} {xx} {yy}',color)
  s+=path(f'M {xx} {yy} Q {24-i} {yy+1} {32-i*2} {yy-16} Q {10+i} {yy-13} {xx} {yy}',color)
 return f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})">{s}</g>'
TDEFS=grad('bark','#a5855b','#665748','100%','0%')+grad('moss','#9ebf73','#527e58','90%','100%')
def trunk(variant):
 # All variants have straight central collision silhouette; decorative leaves remain cosmetic.
 s=path('M 77 24 Q 111 10 150 25 L 155 482 Q 165 506 185 520 L 54 520 Q 73 493 73 461 Z','url(#bark)')
 s+=path('M 83 27 L 97 26 Q 91 188 104 324 L 98 501 L 78 508 Q 91 307 83 27','#c1a16b','opacity=".45"')
 s+=path('M 143 28 L 151 30 L 155 482 L 175 514 L 140 510 Q 147 358 137 278 Z','#4e4f40','opacity=".6"')
 for j in range(9):
  x=86+(j%4)*16;y=40+j*48
  s+=path(f'M {x} {y} q -8 25 3 44 q 9 24 -1 47','none','stroke="#5b5342" stroke-width="2.4" opacity=".55" stroke-linecap="round"')
 s+=ellipse(115,27,38,13,'#c3ad77')+ellipse(115,26,27,8,'none','stroke="#8c7956" stroke-width="2"')+ellipse(115,26,13,4,'none','stroke="#927c52" stroke-width="1.5"')
 s+=path('M 77 43 Q 99 36 97 62 Q 92 75 93 97 Q 86 114 76 97 Z','url(#moss)')
 s+=path('M 137 157 Q 154 151 154 181 L 155 233 Q 141 231 143 207 Q 136 189 137 157','url(#moss)')
 for x,y,r in [(91,165,7),(128,370,9),(112,433,5),(83,295,6)]:
  s+=ellipse(x,y,r,r*.6,'#bdc294','opacity=".65"')+ellipse(x+5,y+7,r*.6,r*.35,'#cbd1a6','opacity=".5"')
 s+=bromelia(146,130+variant*65,.65)
 s+=fern(83,448-variant*45,.6,-32,'#447e5e')
 s+=path('M 68 509 Q 90 492 113 506 Q 138 489 166 511 L 181 520 L 54 520 Z','#547e52')
 return s
for i in range(3):save(f'trunk-{i+1:02}',trunk(i),240,540,TDEFS,f'Tronco com bromélia, variação {i+1}')
for i in range(2):
 s=path(f'M 90 -5 C {30+i*40} 90 {150-i*40} 150 81 239 Q 48 294 85 347','none','stroke="#2c6d58" stroke-width="6" stroke-linecap="round"')
 s+=path('M 92 0 Q 74 79 93 122','none','stroke="#83aa6b" stroke-width="2"')
 for x,y,a in [(80,32,-65),(80,62,25),(91,104,-73),(98,140,30),(88,187,-68),(72,231,20),(62,274,-80),(68,306,35)]:s+=leaf(x,y,a,.7,'#639b68' if (y%2) else '#398163')
 save(f'vine-{i+1:02}',s,180,380,'',f'Cipó decorativo {i+1}')
save('bromelia',bromelia(140,220,1.7),280,260,'','Bromélia')
save('fern',fern(140,260,2,-10),280,300,'','Samambaia')

# Four independent layers. Elements near seams are repeated on both edges.
W,H=1920,1080
LDEFS=grad('sky','#f2e8bf','#b7d2bb')
sky='<rect width="1920" height="1080" fill="url(#sky)"/>'
sky+=ellipse(1250,295,155,155,'#fff3cf','opacity=".58"')+ellipse(1250,295,112,112,'#fff8df','opacity=".75"')
sky+=path('M 0 720 Q 190 555 360 650 T 760 645 T 1120 690 T 1540 630 T 1920 710 L 1920 1080 L 0 1080 Z','#93bca9')
sky+=path('M 0 820 Q 200 690 410 765 T 850 760 T 1280 790 T 1660 740 T 1920 820 L 1920 1080 L 0 1080 Z','#78a993','opacity=".65"')
# Equal colors at either edge, sky layer remains stationary in demo.
save('forest-01-atmosphere',sky,W,H,LDEFS,'Camada 1: atmosfera, luz e relevo distante')
def tree_shape(x,base,height,width,color,canopy=True,detail=False):
 s=path(f'M {x-width*.25} {base} Q {x-width*.1} {base-height*.5} {x-width*.2} {base-height} L {x+width*.12} {base-height} Q {x+width*.18} {base-height*.5} {x+width*.45} {base} Z',color)
 for side,dy in [(-1,.6),(1,.76),(-1,.86)]:
  s+=path(f'M {x} {base-height*dy} Q {x+side*width} {base-height*(dy+.02)} {x+side*width*2.7} {base-height*(dy+.18)} L {x+side*width*2.5} {base-height*(dy+.2)} Q {x+side*width*.7} {base-height*(dy+.10)} {x} {base-height*(dy+.08)} Z',color)
 if canopy:
  for dx,dy,rx,ry in [(-1.8,-.94,4.5,.075),(1.6,-1.02,4.9,.085),(0,-1.08,4.6,.075)]:s+=ellipse(x+dx*width,base+dy*height,rx*width,ry*height,color)
 if detail:s+=path(f'M {x} {base-20} Q {x-width*.2} {base-height*.6} {x} {base-height*.95}','none','stroke="#9bb77b" stroke-width="4" opacity=".16"')
 return s
r=random.Random(41)
far=''
for i in range(15):
 x=i*145;h=r.randint(480,740);wid=r.randint(12,23)
 for shift in [-1920,0,1920]:far+=tree_shape(x+shift,1050,h,wid,'#558f7b',True)
far+=path('M 0 1020 Q 480 950 960 1020 T 1920 1020 L 1920 1080 L 0 1080 Z','#558f7b')
save('forest-02-distant-trees',far,W,H,'','Camada 2: árvores distantes, fundo transparente')
mid=''
for x,base,h,w in [(120,1080,1100,60),(730,1080,1300,58),(1440,1080,1220,76),(1840,1080,1120,42)]:
 for shift in [-1920,0,1920]:
  mid+=tree_shape(x+shift,base,h,w,'#326f60',True,True)
  mid+=tree_shape(x+shift+18,base,h*.99,w*.2,'#50846b',False)
for i in range(20):
 x=i*107
 for shift in [-1920,0,1920]:mid+=ellipse(x+shift,1080,90,80+(i%4)*18,'#367562')
save('forest-03-mid-canopy',mid,W,H,'','Camada 3: troncos e copas intermediárias, transparente')
fore=''
for x in range(0,1920,160):
 for shift in [-1920,0,1920]:
  fore+=ellipse(x+shift,1070,110,58+(x%4)*12,'#184f46')
  fore+=fern(x+shift,1110,.9+(x%3)*.2,-30+(x%60),'#225f4d')
for x,a in [(80,25),(500,-20),(1060,30),(1670,-18)]:
 for shift in [-1920,0,1920]:fore+=bromelia(x+shift,1090,1.3)
# Overhead leaves stay at the top margin, leaving a readable flight corridor.
for x in range(0,1920,160):
 for shift in [-1920,0,1920]:
  fore+=ellipse(x+shift,-45,126,96+(x%3)*12,'#1b5148')
  for j in range(3):fore+=leaf(x+shift+j*34,10+j*9,150+j*16,1.3,'#276956')
save('forest-04-foreground',fore,W,H,'','Camada 4: folhas e samambaias próximas, transparente')

# Exact raster atlas metadata, exported at 1x and 2x.
meta={'frames':{},'meta':{'app':'Chaua Educa native SVG art generator','version':'1','image':'chaua-flight-sheet.png','format':'RGBA8888','size':{'w':1280,'h':640},'scale':'1'}}
for i in range(8):meta['frames'][f'fly-{i:02}']={'frame':{'x':i%4*320,'y':i//4*320,'w':320,'h':320},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':320,'h':320},'sourceSize':{'w':320,'h':320},'pivot':{'x':.55,'y':.54}}
(ROOT/'chaua-flight-atlas.json').write_text(json.dumps(meta,indent=2), encoding='utf-8')
# Overview designed from the actual vector sources, not an unrelated illustration.
def img(name,x,y,w,h):
 data=base64.b64encode((SVG/f'{name}.svg').read_bytes()).decode()
 return f'<image href="data:image/svg+xml;base64,{data}" x="{x}" y="{y}" width="{w}" height="{h}"/>'
def text(x,y,t,size=24,color='#1c493a',weight=400):return f'<text x="{x}" y="{y}" font-family="DejaVu Sans, sans-serif" font-size="{size}" fill="{color}" font-weight="{weight}">{t}</text>'
board='<rect width="1920" height="2320" fill="#f5f1e5"/>'
board+=text(90,91,'CHAUÁ EDUCA  /  DIREÇÃO DE ARTE 01',19,'#69856d',600)+text(90,161,'Uma floresta de descobertas.',53,weight=700)+text(90,206,'Personagem, coletas e cenário • Ilustração vetorial original • Proposta para avaliação',20,'#6a7b68')
for layer in ['forest-01-atmosphere','forest-02-distant-trees','forest-03-mid-canopy','forest-04-foreground']:board+=img(layer,80,250,1760,990)
board+=img('trunk-01',1310,830,175,395)+'<g transform="rotate(180 1397.5 442.5)">'+img('trunk-02',1310,245,175,395)+'</g>'+img('chaua-flight-00',680,650,300,300)+img('fruit-Manga',1200,668,110,110)
board+=text(120,1160,'MATA ATLÂNTICA',18,'#e8ead0',600)+text(120,1200,'Luz quente. Quatro planos. Um voo lateral.',26,'#e8ead0',500)
board+=text(90,1315,'01  /  UM CHAUÁ COM IDENTIDADE',22,weight=600)
board+=img('chaua-hero',70,1350,410,410)
board+=text(505,1390,'Ciclo de voo · 8 poses alinhadas',20,'#6a7b68')
for i in range(8):board+=img(f'chaua-flight-{i:02}',500+(i%4)*325,1420+(i//4)*160,230,175)
board+=text(90,1820,'02  /  SETE DESCOBERTAS',22,weight=600)
for i,name in enumerate(FRUITS):
 x=70+i*255;board+=img('fruit-'+name,x,1860,230,230)+text(x+72,2125,{'Mamao':'Mamão'}.get(name,name),18,'#53705d')
board+=text(90,2240,'SVG editável + PNG transparente + atlas de voo + prévia animada',22,'#6a7b68')
(ROOT/'review'/'overview.svg').write_text(wrap(board,1920,2320,label='Prancha de avaliação das artes Chauá Educa'), encoding='utf-8')
# Review page embeds every source, remains functional as a single offline HTML file.
def datauri(name):return 'data:image/svg+xml;base64,'+base64.b64encode((SVG/f'{name}.svg').read_bytes()).decode()
review='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Chauá Educa — Artes 01</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f1e5;color:#234c3d;font:16px system-ui,sans-serif}header,main{max-width:1280px;margin:auto;padding:32px}h1{font-size:clamp(28px,5vw,58px);letter-spacing:-2px;margin:10px 0}h2{margin-top:45px}p{color:#6b806a;line-height:1.7}.eyebrow{font-size:11px;letter-spacing:3px}.scene{aspect-ratio:16/9;position:relative;overflow:hidden;border-radius:18px;background:#b7d2bb}.layer{position:absolute;inset:0;background-size:100% 100%;background-repeat:repeat-x}.layer.moving{width:200%;background-size:50% 100%;animation:pan linear infinite}.l2{animation-duration:90s!important}.l3{animation-duration:50s!important}.l4{animation-duration:30s!important}.flying{position:absolute;left:27%;top:30%;width:21%;aspect-ratio:1;z-index:4}.flying img{position:absolute;width:100%;opacity:0}.flying img:first-child{opacity:1}.obstacle{position:absolute;width:13%;height:42%;right:20%;object-fit:fill}.top{top:-5%;transform:rotate(180deg)}.bottom{bottom:-4%}.collect{position:absolute;width:6%;right:23%;top:46%;z-index:4}.toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:18px 0}button{border:0;border-radius:8px;background:#245841;color:#fff;padding:12px 18px;font:inherit;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px}.card{background:#e9ecdc;border:1px solid #d4ddc7;border-radius:14px;padding:14px;text-align:center}.card img{width:100%;aspect-ratio:1;object-fit:contain}.card small{color:#718467}.layers{display:grid;grid-template-columns:1fr 1fr;gap:18px}.layer-card{background:repeating-conic-gradient(#e4e8de 0% 25%,#eff1e9 0% 50%) 0/24px 24px;border-radius:12px;overflow:hidden}.layer-card img{width:100%;display:block}.paused .moving{animation-play-state:paused}footer{font-size:12px;color:#718467;padding:40px 0}@keyframes pan{to{transform:translateX(-50%)}}@media(max-width:650px){header,main{padding:20px}.layers{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.moving{animation-play-state:paused!important}}</style><header><div class="eyebrow">CHAUÁ EDUCA • ESTUDO VISUAL 01</div><h1>Uma floresta de descobertas.</h1><p>Prévia de arte para avaliação. As imagens abaixo são os próprios arquivos do pacote; esta página não é uma partida do jogo.</p></header><main><div class="scene">'''
for j,name in enumerate(['forest-01-atmosphere','forest-02-distant-trees','forest-03-mid-canopy','forest-04-foreground']):review+=f'<div class="layer {"moving l"+str(j+1) if j else ""}" style="background-image:url({datauri(name)})"></div>'
review+=f'<img class="obstacle top" src="{datauri("trunk-01")}" alt="Tronco superior"><img class="obstacle bottom" src="{datauri("trunk-02")}" alt="Tronco inferior"><img class="collect" src="{datauri("fruit-Manga")}" alt="Manga">'
review+='<div class="flying" aria-label="Chauá animado">'+''.join(f'<img src="{datauri(f"chaua-flight-{i:02}")}" alt="">' for i in range(8))+'</div></div><div class="toolbar"><button id="pause">Pausar animação</button><label>Voo <input id="speed" type="range" min="6" max="18" value="12"> <output id="fps">12</output> quadros/s</label></div><h2>Chauá • oito poses de voo</h2><p>Testa e coroa vermelhas, face azulada, corpo verde e bico cinza. Interpretação estilizada de Amazona rhodocorytha, com cauda curta. O corpo mantém posição fixa; as asas articulam no ombro.</p><div class="grid">'
for i in range(8):review+=f'<div class="card"><img src="{datauri(f"chaua-flight-{i:02}")}" alt="Pose {i+1}"><small>POSE {i+1:02}</small></div>'
review+='</div><h2>Sete coletas</h2><p>Uma coleção lúdica. Não representa recomendação de alimentação de aves.</p><div class="grid">'
for name in FRUITS:review+=f'<div class="card"><img src="{datauri("fruit-"+name)}" alt="{name}">{name}</div>'
review+='</div><h2>Troncos, bromélias e cipós</h2><p>Folhas ornamentais não devem ampliar as hitboxes. Os cipós desta proposta são decorativos.</p><div class="grid">'
for name in ['trunk-01','trunk-02','trunk-03','vine-01','vine-02','bromelia','fern']:review+=f'<div class="card"><img src="{datauri(name)}" alt="{name}"><small>{name}</small></div>'
review+='</div><h2>Quatro camadas independentes</h2><p>A primeira camada é opaca. As demais têm transparência real; o quadriculado é apenas a superfície de inspeção.</p><div class="layers">'
for name in ['forest-01-atmosphere','forest-02-distant-trees','forest-03-mid-canopy','forest-04-foreground']:review+=f'<div><div class="layer-card"><img src="{datauri(name)}" alt="{name}"></div><p>{name}</p></div>'
review+='''</div><footer>Chauá Educa 2.0 • Artes vetoriais originais para avaliação • Referência de identificação: World Parrot Trust, Red-browed Amazon. A proposta ainda não substitui os assets do jogo.</footer></main><script>const frames=[...document.querySelectorAll('.flying img')];let running=!matchMedia('(prefers-reduced-motion:reduce)').matches,index=0,last=0;const btn=document.getElementById('pause');function refresh(){document.body.classList.toggle('paused',!running);btn.textContent=running?'Pausar animação':'Reproduzir animação';}refresh();btn.onclick=()=>{running=!running;refresh();};document.getElementById('speed').oninput=e=>document.getElementById('fps').value=e.target.value;function tick(t){if(running&&t-last>1000/Number(document.getElementById('speed').value)){frames[index].style.opacity=0;index=(index+1)%8;frames[index].style.opacity=1;last=t;}requestAnimationFrame(tick)}requestAnimationFrame(tick);</script></html>'''
(ROOT/'review'/'avaliar-artes.html').write_text(review, encoding='utf-8')
(ROOT/'manifest.json').write_text(json.dumps({'version':'art-direction-01','native_format':'SVG','bird':{'frames':8,'frameSize':[320,320],'sheetSize':[1280,640],'fps':12,'atlas':'chaua-flight-atlas.json'},'collection':FRUITS,'parallax':{'size':[1920,1080],'layers':4,'transparentLayers':[2,3,4]},'sourceReference':'https://parrots.org/encyclopedia/red-browed-amazon/','status':'For visual review; not yet integrated'},indent=2), encoding='utf-8')
print(f'Created {len(list(SVG.glob("*.svg")))} SVG sources and review files')
