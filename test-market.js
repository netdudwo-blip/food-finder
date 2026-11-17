'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('chart pointer and keyboard reveal exact values after independent commodity and period selection',async()=>{
 class Element{
  constructor(tag,text){this.tag=tag;this.textContent=text||'';this.children=[];this.style={setProperty(){}};this.dataset={};this.clientWidth=500;this.value='';}
  append(...children){for(const child of children){if(child instanceof Element)child.parentElement=this;this.children.push(child)}}
  replaceChildren(...children){this.children=[];this.append(...children)}
  setAttribute(){}
  querySelector(selector){return this.children.find(c=>c.className===selector.slice(1))}
  getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true})}
  getBoundingClientRect(){return {left:0,width:500}}
 }
 const elements=new Map(['market-grid','market-date'].map(id=>[id,new Element('div')]));
 class Option extends Element{constructor(name,value){super('option',name);this.value=value}}
 const data=JSON.parse(fs.readFileSync('static/market-data.json','utf8'));
 const ctx=vm.createContext({document:{getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},window:{devicePixelRatio:1},ResizeObserver:class{observe(){}},Option,
  fetch:async()=>({ok:true,json:async()=>data})});
 // Browsers select the first appended option by default.
 const append=Element.prototype.append;
 Element.prototype.append=function(...children){append.apply(this,children);if(this.tag==='select'&&!this.value)this.value=children[0]?.value||'';};
 vm.runInContext(fs.readFileSync('static/market.js','utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 const oil=elements.get('market-grid').children[3];
 const controls=oil.children.find(c=>c.className==='market-controls');
 const commodity=controls.children[0].children[0],period=controls.children[1].children[0];
 commodity.value='1';commodity.onchange();period.value='monthly';period.onchange();
 const chart=oil.children.find(c=>c.className==='market-chart'),canvas=chart.children[0],tip=chart.children[1];
 canvas.onfocus();
 assert.equal(tip.hidden,false);
 assert.equal(tip.children[0].textContent,'2026-10');
 assert.match(tip.children[1].textContent,/WTI.*97.7.*USD/);
 assert.equal(tip.children.length,2);
 canvas.onkeydown({key:'Home',preventDefault(){}});
 assert.equal(tip.children[0].textContent,'2025-11');
 canvas.onpointerleave();assert.equal(tip.hidden,true);
 canvas.onpointermove({clientX:485});
 assert.equal(tip.children[0].textContent,'2026-10');
 canvas.onkeydown({key:'Escape'});assert.equal(tip.hidden,true);
});
