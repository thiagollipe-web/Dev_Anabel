
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../grades.js');
test('conceptual educational questions do not require a grade spreadsheet',()=>{for(const q of ['Explique a aprendizagem escolar e compare o desempenho de SNN.','Crie slides sobre desempenho escolar e plasticidade sináptica','Explique a média escolar e as estratégias pedagógicas'])assert.equal(G.isGradeRequest(q),false,q);});
test('explicit grade calculations and material requests retain deterministic processing',()=>{for(const q of ['Analise as notas de fechamento','Calcule a média das notas dos alunos','Crie slides sobre as notas de fechamento dos alunos','Confira as notas da turma','Analise as notas do bimestre'])assert.equal(G.isGradeRequest(q),true,q);});
