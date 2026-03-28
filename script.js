function add(v){
document.getElementById("expresion").value += v
}

function detectarVariables(expr){

let letras = expr.match(/[a-zA-Z]/g)

if(!letras) return []

return [...new Set(letras)]
}

function convertir(expr){

expr = expr.replace(/∧/g,"&&")
expr = expr.replace(/∨/g,"||")
expr = expr.replace(/¬/g,"!")
expr = expr.replace(/⊕/g,"!=")

// implicación
expr = expr.replace(/(.*?)→(.*?)/g,"(!$1 || $2)")

// bicondicional
expr = expr.replace(/↔/g,"==")

return expr
}

function resolver(){

let exprOriginal = document.getElementById("expresion").value

if(exprOriginal.trim()==""){
alert("Escribe una expresión lógica")
return
}

let variables = detectarVariables(exprOriginal)

if(variables.length==0){
alert("No se detectaron variables")
return
}

let expr = convertir(exprOriginal)

let filas = Math.pow(2,variables.length)

// crear tabla base
let tabla = "<table><tr>"

variables.forEach(v=>{
tabla += "<th>"+v+"</th>"
})

tabla += "<th>Resultado</th></tr></table>"

document.getElementById("tabla").innerHTML = tabla

let table = document.querySelector("#tabla table")

for(let i=0;i<filas;i++){

setTimeout(()=>{

let valores = {}

variables.forEach((v,index)=>{
valores[v] = Boolean(i & (1 << (variables.length-index-1)))
})

let exprEval = expr

variables.forEach(v=>{
let regex = new RegExp("\\b"+v+"\\b","g")
exprEval = exprEval.replace(regex,valores[v])
})

let resultado

try{
resultado = eval(exprEval)
}catch{
resultado="Error"
}

let fila = "<tr>"

variables.forEach(v=>{
fila += "<td>"+valores[v]+"</td>"
})

fila += "<td>"+resultado+"</td></tr>"

table.innerHTML += fila

}, i * 300)

}

}