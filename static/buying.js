'use strict';
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.FoodBuying=factory();
})(globalThis,()=>{
  const text=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
  const normalized=value=>text(value).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const report=value=>{
    const safe=Number.isSafeInteger(value)?String(value):text(value,41);
    return /^[0-9A-Za-z-]{4,40}$/.test(safe)?safe.toUpperCase():'';
  };
  const barcode=value=>/^(?:\d{8}|\d{12,14})$/.test(text(value,15))?text(value,15):'';
  const matchedBarcode=(a,b)=>a&&b&&a.padStart(14,'0')===b.padStart(14,'0');
  const number=value=>value===null||value===undefined||String(value).trim()===''?null:Number(value);
  const money=(value,allowZero=false)=>{
    const n=number(value);
    return Number.isSafeInteger(n)&&n>=(allowZero?0:1)&&n<=1e9?n:null;
  };
  function httpsUrl(value){
    try{
      const link=new URL(text(value,2049));
      return link.protocol==='https:'&&!link.username&&!link.password&&link.href.length<=2048?link.href:'';
    }catch{return '';}
  }
  function packageSpec(values={}){
    if(!values||typeof values!=='object')return null;
    const unit=values.unit, amount=number(values.amount), count=number(values.count);
    if(!['mL','g','개'].includes(unit)||!Number.isFinite(amount)||amount<0.001||amount>1e7||
      !Number.isSafeInteger(count)||count<1||count>1e5||(unit==='개'&&!Number.isSafeInteger(amount)))return null;
    return {unit,amount,count};
  }
  function baseProduct(p,mode,preferences={}){
    const no=report(p?.PRDLST_REPORT_NO), name=text(p?.PRDLST_NM), maker=text(p?.BSSH_NM), permit=report(p?.LCNS_NO);
    if(!no||!name||!['live','demo'].includes(mode))return null;
    return {key:`${mode}:${no}:${permit}`,mode,report:no,name,maker,permit,type:text(p.PRDLST_DCNM),
      spec:packageSpec(preferences?.spec),barcode:barcode(preferences?.barcode),distributor:text(preferences?.distributor)};
  }
  function quote(raw){
    const date=text(raw?.date,11), link=httpsUrl(raw?.link), price=money(raw?.price), shipping=money(raw?.shipping,true);
    const id=text(raw?.id,100),baseKey=text(raw?.baseKey,100),item=text(raw?.item),seller=text(raw?.seller,100);
    if(!id||!baseKey||!item||!seller||!price||!link||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    if(raw.shipping!==null&&raw.shipping!==undefined&&String(raw.shipping).trim()!==''&&shipping===null)return null;
    return {id,baseKey,item,seller,link,price,shipping,date,maker:text(raw.maker),distributor:text(raw.distributor),
      spec:packageSpec(raw.spec),barcode:barcode(raw.barcode),report:report(raw.report),
      similar:raw.similar===true,labelChecked:raw.labelChecked===true};
  }
  function classify(base,q){
    if(q.baseKey!==base.key)return 'unrelated';
    if(q.similar)return 'similar';
    const spec=base.spec, bought=q.spec;
    if(!spec||!bought||spec.unit!==bought.unit||spec.amount!==bought.amount||spec.count!==bought.count)return 'review';
    const hasBothBarcodes=base.barcode&&q.barcode;
    if(hasBothBarcodes&&!matchedBarcode(base.barcode,q.barcode))return 'review';
    if(q.report&&q.report!==base.report)return 'review';
    if(base.maker&&q.maker&&normalized(base.maker)!==normalized(q.maker))return 'review';
    const sameLabel=q.labelChecked&&base.maker&&normalized(base.maker)===normalized(q.maker)&&normalized(base.name)===normalized(q.item);
    return (hasBothBarcodes||q.report===base.report||sameLabel)?'same':'review';
  }
  function total(q){const price=money(q?.price),shipping=money(q?.shipping,true);return price===null||shipping===null?null:price+shipping;}
  function unitPrice(q){
    const sum=total(q), spec=q?.spec;
    if(sum===null||!spec)return null;
    return {value:sum/(spec.amount*spec.count)*(spec.unit==='개'?1:1000),unit:{mL:'L',g:'kg',개:'개'}[spec.unit]};
  }
  function groups(base,items){
    const same=[],similar=[],review=[];
    if(base)for(const q of items){
      const kind=classify(base,q);
      ({same,similar,review})[kind]?.push(q);
    }
    same.sort((a,b)=>(total(a)??Infinity)-(total(b)??Infinity)||b.date.localeCompare(a.date));
    similar.sort((a,b)=>b.date.localeCompare(a.date));
    return {same,similar,review,mode:same.length?'same':similar.length?'similar':'empty',
      rows:same.length?same:similar,lowest:same.find(q=>total(q)!==null)?.id??null};
  }
  function pageOf(rows,wanted=1){
    const pages=Math.max(1,Math.ceil(rows.length/10)),page=Math.max(1,Math.min(pages,Math.trunc(Number(wanted))||1)),start=(page-1)*10;
    return {page,pages,start,rows:rows.slice(start,start+10),total:rows.length};
  }
  function searchLinks(base){
    const spec=base.spec;
    const query=[base.name,base.maker,spec?`${spec.amount}${spec.unit} ${spec.count}개`:'',base.barcode].filter(Boolean).join(' ');
    const q=encodeURIComponent(query);
    return [
      {label:'쿠팡 검색',url:'https://www.coupang.com/np/search?q='+q},
      {label:'네이버쇼핑',url:'https://search.shopping.naver.com/search/all?query='+q},
      {label:'Google 검색',url:'https://www.google.com/search?q='+q},
      {label:'기타 판매처 검색',url:'https://www.google.com/search?q='+encodeURIComponent(query+' 식자재 판매 가격 -site:coupang.com -site:naver.com')}
    ];
  }
  return {text,report,barcode,money,httpsUrl,packageSpec,baseProduct,quote,classify,total,unitPrice,groups,pageOf,searchLinks};
});
