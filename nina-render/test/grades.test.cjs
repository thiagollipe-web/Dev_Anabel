'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../grades.js');
const source=text=>[{name:'fechamento.csv',text}];
test('decimal comma, zero and absent values have separate meanings',()=>{const g=G.analyze(source('Aluno;Nota final\nAna;8,5\nBruno;0\nCarla;\nDavi;9')).groups[0];assert.equal(g.records.length,4);assert.equal(g.columns[0].count,3);assert.equal(g.columns[0].missing,1);assert.equal(g.columns[0].mean,17.5/3);assert.equal(g.columns[0].min,0);});
test('exclude explicit transferred students, never infer a pass mark',()=>{const g=G.analyze(source('Aluno;Nota;Situação\nAna;8;Ativo\nBruno;2;Transferido')).groups[0];assert.equal(g.records.length,1);assert.equal(g.excluded,1);assert(!G.report({groups:[g]}).includes('aprovado'));});
test('reject partial, duplicate, malformed and out-of-range data',()=>{assert.throws(()=>G.analyze([{name:'x',text:'a',partial:true}]),/parciais/);for(const text of ['Aluno;Nota\nAna;11','Aluno;Nota\nAna;8\nAna;9','Aluno;Nota\n;8','Aluno;Nota\nAna;abc'])assert.throws(()=>G.analyze(source(text)));});
test('all 1800 rows are used in calculation',()=>{const text='Aluno;Nota\n'+Array.from({length:1800},(_,i)=>'Aluno '+i+';'+(i%10)).join('\n');const g=G.analyze(source(text)).groups[0];assert.equal(g.records.length,1800);assert.equal(g.columns[0].mean,4.5);});
test('quoted names and multiple bimesters remain separate',()=>{const g=G.analyze(source('Aluno;1º Bimestre;2º Bimestre\n"Ana; Silva";8;9')).groups[0];assert.equal(g.records[0].name,'Ana; Silva');assert.deepEqual(g.columns.map(c=>c.mean),[8,9]);});

test('musical notes and company closing are not student grades',()=>{assert.equal(G.isGradeRequest('Crie slides sobre notas musicais'),false);assert.equal(G.isGradeRequest('Fechamento da bolsa de valores'),false);assert.equal(G.isGradeRequest('Analise as notas de fechamento dos alunos'),true);});
