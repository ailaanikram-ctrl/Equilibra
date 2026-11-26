import json,re,subprocess,os,sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import BaseDocTemplate,PageTemplate,Frame,Paragraph,Spacer,PageBreak,KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
D='/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('F',D+'DejaVuSans.ttf'));pdfmetrics.registerFont(TTFont('FB',D+'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFontFamily('F',normal='F',bold='FB')
RED=colors.HexColor('#7A2E1E');ACC=colors.HexColor('#B5472F');GR=colors.HexColor('#6b6b6b')
S=lambda n,**k:ParagraphStyle(n,fontName=k.pop('f','F'),**k)
T=S('t',fontSize=17,leading=21,textColor=RED,f='FB',spaceAfter=3)
H=S('h',fontSize=10.5,leading=13,textColor=ACC,f='FB',spaceBefore=9,spaceAfter=3)
B=S('b',fontSize=8.8,leading=12.5,leftIndent=8,bulletIndent=0)
P=S('p',fontSize=8.8,leading=12.5)
SM=S('s',fontSize=7.4,leading=10,textColor=GR)
TAG=S('tag',fontSize=8,leading=11,textColor=colors.white,f='FB',backColor=ACC,borderPadding=(2,4,2,4))
txt=subprocess.run(['pdftotext','-layout',sys.argv[1],'-'],capture_output=True,text=True).stdout
petua={}
for pg in txt.split('\f'):
    m=re.match(r'\s*(\d+)\. ',pg)
    if m:
        q=re.search(r'PETUA ORANG BARU MASAK\n(.*?)(?:\nRUJUKAN|\Z)',pg,re.S)
        if q:petua[int(m.group(1))]=re.sub(r'\s*\n\s*',' ',q.group(1)).strip()
J=json.load(open('data/recipes.json'))['recipes']
def esc(s):return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
def status(r):
    if r.get('web_sourced'):return 'SUMBER: Kementerian Kesihatan Malaysia, Resipi Sihat 2011 (kuantiti & nutrien seperti diterbitkan)'
    if r.get('draft_level')=='outline':return 'STATUS: DRAF RINGKAS - kuantiti tidak lengkap, sila semak dengan sumber sebenar'
    if r.get('drafted'):return 'STATUS: DRAF daripada kaedah masakan standard - sila semak sebelum guna'
    return 'SUMBER: Ensiklopedia Masakan Malaysia Edisi 7 (resipi penuh dalam buku)'
class Doc(BaseDocTemplate):
    def __init__(s,fn):
        super().__init__(fn,pagesize=A4,leftMargin=20*mm,rightMargin=20*mm,topMargin=20*mm,bottomMargin=20*mm,title='Ensiklopedia Masakan Malaysia - Edisi Lengkap',author='Equilibra')
        s.addPageTemplates([PageTemplate(id='a',frames=[Frame(s.leftMargin,s.bottomMargin,s.width,s.height,id='f')],onPage=s.foot)])
    def foot(s,c,d):
        c.setFont('F',7);c.setFillColor(GR);c.drawCentredString(A4[0]/2,10*mm,'Edisi Lengkap - Semua Resipi | Halaman %d'%d.page)
    def afterFlowable(s,f):
        if hasattr(f,'_bm'):
            k='r%d'%f._bm[0];s.canv.bookmarkPage(k);s.canv.addOutlineEntry(f._bm[1],k,0,0)
from detailed import DET
doc=Doc(sys.argv[2])
st=[Spacer(1,40*mm),Paragraph('<font size=24>ENSIKLOPEDIA MASAKAN MALAYSIA</font>',S('c',fontSize=24,leading=30,textColor=RED,f='FB',alignment=1)),
Paragraph('EDISI LENGKAP - SEMUA RESIPI',S('c2',fontSize=11,leading=15,textColor=GR,alignment=1,spaceAfter=18)),
Paragraph('Setiap resipi mempunyai bahan-bahan dan cara penyediaan | Status sumber pada setiap halaman',S('c3',fontSize=9,leading=13,textColor=ACC,alignment=1,spaceAfter=30)),
Paragraph('Cara guna buku ini',S('h1',fontSize=14,leading=18,textColor=RED,f='FB',spaceAfter=6)),
Paragraph('Buku ini menyusun semua 219 hidangan daripada Ensiklopedia Masakan Malaysia Edisi 7 dan melengkapkan setiap satu dengan senarai bahan serta langkah penyediaan. <b>Sebahagian resipi (sepuluh dahulu) kini mempunyai penerangan penuh satu halaman; selebihnya masih ringkas. Hanya sebahagian kecil resipi datang terus daripada buku asal atau sumber diterbitkan.</b> Selebihnya ditulis daripada kaedah masakan standard dan ditandakan pada setiap halaman sebagai DRAF atau DRAF RINGKAS. Sila semak draf dengan sumber sebenar sebelum dihidangkan, terutama makanan ditapai dan hidangan serantau Sabah dan Sarawak. Nilai nutrien hanya ditunjukkan jika diterbitkan oleh sumber (Kementerian Kesihatan Malaysia); jika tiada, nutrien adalah tidak diketahui dan tidak direka.',P),
Spacer(1,8)]
n={'book':0,'moh':0,'draft':0,'out':0}
for r in J:
    n['moh' if r.get('web_sourced') else 'out' if r.get('draft_level')=='outline' else 'draft' if r.get('drafted') else 'book']+=1
st+=[Paragraph('Ringkasan sumber: %d resipi daripada buku asal, %d daripada Kementerian Kesihatan Malaysia, %d draf, %d draf ringkas.'%(n['book'],n['moh'],n['draft'],n['out']),SM),PageBreak()]
st+=[Paragraph('Senarai Resipi',T),Spacer(1,4)]
for r in J:st.append(Paragraph('%d. %s'%(r['id'],esc(r['title'])),S('toc',fontSize=8.6,leading=11.5)))
st.append(PageBreak())
for r in J:
    t=Paragraph('%d. %s'%(r['id'],esc(r['title'])),T);t._bm=(r['id'],'%d. %s'%(r['id'],r['title']))
    blk=[t,Paragraph(esc(status(r)),SM)]
    d=DET.get(r['id'])
    if d:
        blk+=[Paragraph(d['h'],S('hh',fontSize=9.5,leading=13,textColor=GR,spaceBefore=3)),Paragraph('BAHAN-BAHAN',H)]
        for g,items in d['B']:
            blk.append(Paragraph(esc(g),S('g',fontSize=9.2,leading=13,f='FB',spaceBefore=4,spaceAfter=1)))
            blk+=[Paragraph(esc(i),S('bb',fontSize=9.2,leading=13,leftIndent=9,bulletIndent=0),bulletText='\u2022') for i in items]
        blk.append(Paragraph('CARA PENYEDIAAN',H))
        blk+=[Paragraph('%d. %s'%(k+1,x),S('ss',fontSize=9.2,leading=13.2,spaceAfter=4)) for k,x in enumerate(d['S'])]
        blk.append(Paragraph('PETUA',H))
        blk+=[Paragraph(esc(x),S('tt',fontSize=9.2,leading=13,leftIndent=9,bulletIndent=0),bulletText='\u2022') for x in d['T']]
        blk+=[Paragraph('PENYIMPANAN',H),Paragraph(esc(d['K']),S('kk',fontSize=9.2,leading=13))]
        if r.get('nutrition'):
            nu=r['nutrition'];lab={'kcal':'tenaga (kcal)','carb_g':'karbohidrat (g)','fat_g':'lemak (g)','protein_g':'protein (g)','fibre_g':'serat (g)','calcium_mg':'kalsium (mg)','iron_mg':'zat besi (mg)','cholesterol_mg':'kolesterol (mg)'}
            blk+=[Paragraph('NUTRIEN SETIAP HIDANGAN (diterbitkan KKM, %s hidangan)'%nu['servings'],H),Paragraph(', '.join('%s %s'%(lab.get(k,k),v) for k,v in nu['per_serving'].items()),P)]
        blk+=[Paragraph('RUJUKAN / SUMBER',H),Paragraph(esc((r.get('source') or '')+' | Penerangan dan petua diperluas'),SM)]
        st+=blk+[PageBreak()];continue
    blk+=[Paragraph('BAHAN-BAHAN',H)]
    blk+=[Paragraph(esc(i),B,bulletText='\u2022') for i in r['ingredients']]
    blk.append(Paragraph('CARA PENYEDIAAN',H))
    blk+=[Paragraph('%d. %s'%(k+1,esc(x)),P) for k,x in enumerate(r['steps'])]
    if r.get('nutrition'):
        nu=r['nutrition'];lab={'kcal':'tenaga (kcal)','carb_g':'karbohidrat (g)','fat_g':'lemak (g)','protein_g':'protein (g)','fibre_g':'serat (g)','calcium_mg':'kalsium (mg)','iron_mg':'zat besi (mg)','cholesterol_mg':'kolesterol (mg)'}
        blk.append(Paragraph('NUTRIEN SETIAP HIDANGAN (diterbitkan KKM, %s hidangan)'%nu['servings'],H))
        blk.append(Paragraph(', '.join('%s %s'%(lab.get(k,k),v) for k,v in nu['per_serving'].items()),P))
    pt=petua.get(r['id'])
    if pt:blk+=[Paragraph('PETUA ORANG BARU MASAK',H),Paragraph(esc(pt),P)]
    blk+=[Paragraph('RUJUKAN / SUMBER',H),Paragraph(esc(r.get('source') or 'Senarai asas daripada Edisi 7'),SM)]
    st+=blk+[PageBreak()]
st.pop()
doc.build(st)
print('built',len(J))
