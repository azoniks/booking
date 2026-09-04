// Use the live booking page's header markup verbatim so the map never drifts
// from the main booking site design. The map is served on the same origin.
(async function copyOriginalHeader(){
  const current=document.querySelector('header.site-header');
  if(!current)return;
  try{
    const response=await fetch('/',{headers:{'Accept':'text/html'}});
    if(!response.ok)return;
    const html=await response.text();
    const parsed=new DOMParser().parseFromString(html,'text/html');
    parsed.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{
      const href=link.getAttribute('href');
      if(href && !document.querySelector(`link[rel="stylesheet"][href="${href}"]`)){
        const copy=document.createElement('link'); copy.rel='stylesheet'; copy.href=href; document.head.appendChild(copy);
      }
    });
    const original=parsed.querySelector('header');
    if(original)current.replaceWith(document.importNode(original,true));
  }catch(_){/* Keep the static fallback when offline. */}
})();
const BOOKING='https://booking.bazaklondaik.ru';
const bridgeCoords=[[82.3,43.2],[78.4,46.4],[73.7,50.5],[67.1,49.4],[63.3,47.5],[58.8,48.3],[52.1,48.4],[47.9,49.8],[44.8,54.3],[41.5,57.6],[39.6,60.6],[37.5,64.1],[35.4,68.1],[33.3,69.5],[31.1,71.7],[27.7,72.9],[25.4,75.4],[23.1,77.6],[20.7,74.3],[18.1,74.5],[15.2,77.7],[12.9,70.7],[11.3,68.7],[9.9,65.3],[8.3,62.1],[7.0,59.4]];
const objects=bridgeCoords.map((p,i)=>({id:`bridge-${i+1}`,number:i+1,title:`Мостик №${i+1}`,type:'bridge',typeLabel:'Мостик для рыбалки',x:p[0],y:p[1],image:i+1>=20?`${BOOKING}/uploads/types/cmp5zotow0017l558i6qzbi37/d6d332a8aad1bd37.jpg`:`${BOOKING}/uploads/types/cmoumt8ft000e14elnq59eqcp/efa9d1c11f4b77b6.jpg`,facts:[i+1>=20?'до 10 гостей':'до 5 гостей',i+1>=20?'от 3 000 ₽':'от 2 500 ₽','у воды'],description:i+1>=20?'Расширенный мостик с беседкой для комфортной рыбалки. Размер 6 × 7,5 м.':'Мостик с беседкой для комфортной рыбалки. Размер 6 × 6 м. В тариф включена установленная норма вылова.',url:`${BOOKING}/?cat=bridges`}));
objects.push(
 {id:'cottage',number:30,title:'Коттедж · номера 1 и 2',type:'room',typeLabel:'Проживание',x:84.5,y:57.7,image:`${BOOKING}/uploads/types/cmp9h1frp0024gv8m9j5gev2n/aba6c1df7206ecfa.jpg`,facts:['до 4 гостей','от 6 000 ₽','заезд 14:00'],description:'Двухкомнатные номера с двуспальной кроватью и диванами. Полы с подогревом, принадлежности для гостей и мангал на улице.',url:`${BOOKING}/booking/cmp9h36sc0026gv8md51c3g84`,label:'Номера 1–2'},
 {id:'hotel',number:35,title:'Гостиничный комплекс · номера 3–7',type:'room',typeLabel:'Проживание',x:76.2,y:74.4,image:`${BOOKING}/uploads/types/cmp9hymia0032gv8mo1p27z01/e9d5e82fa4da9be4.jpg`,facts:['до 4 гостей','от 4 000 ₽','заезд 14:00'],description:'Номера разных категорий: двухкомнатные, однокомнатные и деревянный сруб. Фотографии и варианты размещения доступны в системе бронирования.',url:`${BOOKING}/?cat=rooms`,label:'Номера 3–7'},
 {id:'vip',number:'VIP',title:'VIP-зона',type:'leisure',typeLabel:'VIP-зона',x:87.2,y:14.8,image:`${BOOKING}/uploads/cmp9ent22000igv8m8uvrdl2b/5ab5d1e0dbf0e26e.png`,facts:['до 4 гостей','15 000 ₽ / сутки','беседка включена'],description:'Панорамные окна с выходом к реке, умный дом, тёплые полы и большая беседка с мангалом. Рыбалка включена в стоимость.',url:`${BOOKING}/booking/cmp9ent22000igv8m8uvrdl2b`},
 {id:'zone2',number:43,title:'Зона №2 с деревянным срубом',type:'leisure',typeLabel:'Зона отдыха',x:54.0,y:61.8,image:`${BOOKING}/uploads/cmp9jby17005bgv8mevu5x9ak/0a5e6779000847f6.png`,facts:['беседка до 30 гостей','сруб на 4 гостей','15 000 ₽'],description:'Большая беседка со встроенным мангалом, печью под казан и раковиной. На территории находятся деревянный сруб, туалет и душ.',url:`${BOOKING}/booking/cmp9jby17005bgv8mevu5x9ak`},
 {id:'banquet',number:32,title:'Площадь «Колизей»',type:'leisure',typeLabel:'Банкетная площадка',x:79.0,y:65.0,image:`${BOOKING}/uploads/cmp9ixxvu004rgv8m2pqdv2rd/8baacac8e120145c.png`,facts:['до 150 гостей','от 7 000 ₽','сцена и танцпол'],description:'Площадка для свадеб, юбилеев, дней рождения и других мероприятий. Возможна аренда всей территории или отдельных секций.',url:`${BOOKING}/booking/cmp9ixxvu004rgv8m2pqdv2rd`},
 {id:'gazebo27',number:27,title:'Беседка «Лебеди»',type:'gazebo',typeLabel:'Беседка',x:71.4,y:70.4,image:`${BOOKING}/uploads/types/cmoumt8fr000c14elqgfhooun/1977c52399ffe384.png`,facts:['у воды','для отдыха','бронирование онлайн'],description:'Уютная беседка на территории базы. Подробные условия и актуальная стоимость доступны в разделе беседок.',url:`${BOOKING}/?cat=gazebos`},
 {id:'gazebo29',number:29,title:'Беседка за коттеджем',type:'gazebo',typeLabel:'Беседка',x:86.4,y:54.8,image:`${BOOKING}/uploads/types/cmoumt8fr000c14elqgfhooun/1977c52399ffe384.png`,facts:['рядом с коттеджем','для отдыха','бронирование онлайн'],description:'Беседка в тихой части территории рядом с коттеджем. Перейдите в каталог, чтобы посмотреть условия бронирования.',url:`${BOOKING}/?cat=gazebos`},
 {id:'gazebo31',number:31,title:'Беседка на площади',type:'gazebo',typeLabel:'Беседка',x:75.2,y:56.0,image:`${BOOKING}/uploads/types/cmoumt8fr000c14elqgfhooun/1977c52399ffe384.png`,facts:['рядом с площадью','для компании','бронирование онлайн'],description:'Беседка рядом с центральной площадью и гостиничным комплексом.',url:`${BOOKING}/?cat=gazebos`},
 {id:'safari',number:28,title:'Сафари-парк',type:'leisure',typeLabel:'Развлечения',x:88.5,y:43.5,facts:['животные','прогулочная зона','для всей семьи'],description:'Просторная территория сафари-парка с животными и прогулочным маршрутом.'},
 {id:'waterfall',number:33,title:'Водопад',type:'nature',typeLabel:'Природный объект',x:79.0,y:67.0,facts:['центральная площадь','фотозона'],description:'Декоративный водопад на центральной площади базы.'},
 {id:'stage',number:34,title:'Сцена',type:'service',typeLabel:'Инфраструктура',x:80.4,y:70.0,facts:['мероприятия','рядом с Колизеем'],description:'Сцена для праздников, концертов и мероприятий на территории базы.'},
 {id:'reception',number:36,title:'Магазин и ресепшен',type:'service',typeLabel:'Сервис',x:74.6,y:60.7,facts:['регистрация гостей','магазин','информация'],description:'Здесь можно зарегистрироваться, получить информацию и приобрести необходимые товары.'},
 {id:'gazebo37',number:37,title:'Беседка №37',type:'gazebo',typeLabel:'Беседка',x:48.0,y:61.0,facts:['для отдыха','на территории базы'],description:'Отдельная беседка для отдыха гостей.'},
 {id:'ostriches',number:38,title:'Страусы',type:'leisure',typeLabel:'Животные',x:66.0,y:81.0,facts:['вольер','для всей семьи'],description:'Вольер со страусами в прогулочной части базы.'},
 {id:'zoo',number:39,title:'Зоопарк',type:'leisure',typeLabel:'Развлечения',x:68.6,y:81.0,facts:['животные','семейный отдых'],description:'Зоопарк базы отдыха с животными для знакомства и наблюдения.'},
 {id:'technical',number:40,title:'Техническая зона',type:'service',typeLabel:'Служебная территория',x:63.7,y:69.5,facts:['служебная зона','доступ ограничен'],description:'Техническая территория базы. Доступ для гостей может быть ограничен.'},
 {id:'orchard',number:41,title:'Фруктовый сад',type:'nature',typeLabel:'Природа',x:63.0,y:58.4,facts:['сад','прогулочная зона'],description:'Фруктовый сад на территории базы отдыха.'},
 {id:'playground',number:42,title:'Детская площадка',type:'leisure',typeLabel:'Для детей',x:58.5,y:58.6,facts:['для детей','рядом с зоной отдыха'],description:'Игровая площадка для маленьких гостей базы.'},
 {id:'loghouse',number:44,title:'Сруб',type:'room',typeLabel:'Проживание',x:45.6,y:60.7,facts:['деревянный дом','рядом с водой'],description:'Отдельный деревянный сруб на территории базы.',url:`${BOOKING}/?cat=rooms`},
 {id:'parking-main',number:'P',title:'Основная парковка',type:'service',typeLabel:'Инфраструктура',x:81.5,y:54.7,facts:['парковка','рядом с ресепшеном'],description:'Основная парковка для автомобилей гостей.'},
 {id:'parking-vip',number:'P',title:'Парковка VIP-зоны',type:'service',typeLabel:'Инфраструктура',x:84.3,y:50.0,facts:['парковка','VIP-зона'],description:'Парковочные места рядом с VIP-зоной.'}
);

const stage=document.getElementById('mapStage'),viewport=document.getElementById('viewport'),markers=document.getElementById('markers');
let scale=1,x=0,y=0,drag=null,activeFilter='all';
function renderMarkers(){markers.innerHTML=objects.map(o=>`<button class="marker ${o.type}" style="left:${o.x}%;top:${o.y}%" data-id="${o.id}" data-label="${o.label||o.title}" aria-label="${o.title}">${o.number}</button>`).join('');markers.querySelectorAll('.marker').forEach(m=>m.addEventListener('click',e=>{e.stopPropagation();openCard(objects.find(o=>o.id===m.dataset.id));m.classList.add('selected')}))}
function fit(){const w=1400,h=1400*10352/21775;scale=Math.min(viewport.clientWidth/w,viewport.clientHeight/h);x=(viewport.clientWidth-w*scale)/2;y=(viewport.clientHeight-h*scale)/2;apply()}
function apply(){stage.style.transform=`translate(${x}px,${y}px) scale(${scale})`}
function zoom(f,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2){const next=Math.max(.45,Math.min(4,scale*f));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;apply()}
viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoom(e.deltaY<0?1.15:.87,e.clientX-r.left,e.clientY-r.top)},{passive:false});
viewport.addEventListener('pointerdown',e=>{drag={px:e.clientX,py:e.clientY,x,y};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging')});viewport.addEventListener('pointermove',e=>{if(!drag)return;x=drag.x+e.clientX-drag.px;y=drag.y+e.clientY-drag.py;apply()});viewport.addEventListener('pointerup',()=>{drag=null;viewport.classList.remove('dragging')});
document.getElementById('zoomIn').onclick=()=>zoom(1.25);document.getElementById('zoomOut').onclick=()=>zoom(.8);document.getElementById('resetView').onclick=fit;
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.marker').forEach(m=>{const o=objects.find(o=>o.id===m.dataset.id),matches=activeFilter==='all'||o.type===activeFilter;m.classList.toggle('hidden',!matches);m.classList.toggle('featured',activeFilter!=='all'&&matches)})}));
function openCard(o){const image=document.getElementById('cardImage'),booking=document.getElementById('cardBooking'),info=document.getElementById('cardInfoOnly');image.src=o.image||'assets/klondaik-map-modern-ai.webp';image.alt=o.title;document.getElementById('cardType').textContent=o.typeLabel;document.getElementById('cardNumber').textContent=typeof o.number==='number'?`ОБЪЕКТ №${o.number}`:'ОБЪЕКТ НА КАРТЕ';document.getElementById('cardTitle').textContent=o.title;document.getElementById('cardFacts').innerHTML=o.facts.map(f=>`<span class="fact">${f}</span>`).join('');document.getElementById('cardDescription').textContent=o.description;booking.hidden=!o.url;info.hidden=!!o.url;if(o.url)booking.href=o.url;document.getElementById('objectCard').classList.add('open');document.getElementById('backdrop').classList.add('open')}
function closeCard(){document.getElementById('objectCard').classList.remove('open');document.getElementById('backdrop').classList.remove('open');document.querySelectorAll('.marker').forEach(m=>m.classList.remove('selected'))}document.getElementById('cardClose').onclick=closeCard;document.getElementById('backdrop').onclick=closeCard;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCard()});
renderMarkers();addEventListener('resize',fit);fit();
