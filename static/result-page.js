'use strict';
const text=v=>String(v??'');
function select(rows,o){
 const facets={manufacturers:[...new Set(rows.map(p=>p.BSSH_NM).filter(Boolean))].sort(),types:[...new Set(rows.map(p=>p.PRDLST_DCNM).filter(Boolean))].sort()};
 let selected=rows.filter(p=>(!o.manufacturer||p.BSSH_NM===o.manufacturer)&&(!o.type||p.PRDLST_DCNM===o.type));
 const by=o.sort==='manufacturer'?'BSSH_NM':o.sort==='type'?'PRDLST_DCNM':o.sort==='date'?'PRMS_DT':null;
 selected.sort((a,b)=>{
  const cmp=by?(o.sort==='date'?text(b[by]).localeCompare(text(a[by])):text(a[by]).localeCompare(text(b[by]),'ko')):0;
  return cmp||text(a.PRDLST_REPORT_NO).localeCompare(text(b.PRDLST_REPORT_NO))||text(a.LCNS_NO).localeCompare(text(b.LCNS_NO));
 });
 const total=selected.length,pages=Math.max(1,Math.ceil(total/o.size)),page=Math.min(o.page,pages);
 return {rows:selected.slice((page-1)*o.size,page*o.size),total,pages,page,size:o.size,facets};
}
if(typeof module!=='undefined')module.exports=select;
