'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../grades.js');
// Known production defect: keep visible without representing this case as passing.
test('conceptual educational questions must not require a grade spreadsheet',
 {todo:'BUG-NINA-001: grade intent detector is too broad; production fix remains pending'},()=>{
  assert.equal(G.isGradeRequest('Explique a aprendizagem escolar e compare o desempenho de SNN.'),false);
 });
