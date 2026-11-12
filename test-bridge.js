'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const b=require('./api/bridge').testOnly;
test('HMAC is canonical and valid',()=>{const old=process.env.FOODSAFETY_API_KEY;process.env.FOODSAFETY_API_KEY='test-key';const ts=String(Date.now());const sig=crypto.createHmac('sha256','test-key').update(b.canonical(ts,'I1250','PRDLST_NM','간장',50)).digest('hex');assert.equal(b.signed(ts,sig,'I1250','PRDLST_NM','간장',50),true);assert.equal(b.signed(ts,sig,'I1250','PRDLST_NM','돈까스',50),false);if(old===undefined)delete process.env.FOODSAFETY_API_KEY;else process.env.FOODSAFETY_API_KEY=old;});
test('parse official success and no data responses',()=>{assert.deepEqual(b.normalize({I1250:{RESULT:{CODE:'INFO-000'},total_count:'2',row:[{name:'test'}]}},'I1250'),{rows:[{name:'test'}],total:2});assert.deepEqual(b.normalize({I1250:{RESULT:{CODE:'INFO-200'}}},'I1250'),{rows:[],total:0});});
