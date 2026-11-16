'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const company=require('./lib/company');
const finance=require('./lib/company-revenue');
test('corporate directory resolves normalized names and matching registration numbers',async()=>{
 const found=await company.search('109-81-14886',1);
 const p=await company.profile(found.rows[0].id);
 assert.equal(p.id,'1101110327125');
 assert.equal(p.filing.size,'중견기업');
 assert.equal(p.sales.amount,'3528856015820');
 assert.match(p.sales.source,/rcpNo=/);
 const hits=await company.search('대상',1);
 assert.ok(hits.total>1);assert.equal(hits.page,1);
 assert.equal((await company.search(p.id,1)).total,1);
 await assert.rejects(company.search('(주)',1));
 assert.equal(company.homepage('javascript:alert(1)'),'');
});
test('disclosed sales retain statement basis, period and reporting units',()=>{
 const caption='<table><tr><td>포괄손익계산서 제1기 2025.01.01 부터 2025.12.31 까지 (단위 : 천원)</td></tr></table>';
 const table='<table><tr><td>매출원가</td><td>99</td></tr><tr><td>매출 (주22)</td><td>0</td></tr></table>';
 assert.equal(finance.revenue(caption+table,2025,'별도·개별','123').amount,'0');
 assert.equal(finance.revenue(caption+table,2024,'별도·개별','123'),null);
 assert.equal(finance.revenue(caption+table,2025,'연결','123'),null);
});
