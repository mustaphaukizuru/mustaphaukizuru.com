<<<<<<<< HEAD:public/assets/mercadoPagoService-Bevq3Xpt.js
import{a}from"./index-DyRP5M0z.js";async function o(e){if(!e)throw new Error("Order ID is required");const r=await a("/api/v1/mercadopago/create-preference",{method:"POST",body:JSON.stringify({orderId:e})});return r?.data||r}export{o as c};
========
import{a}from"./index-CAlS0PR6.js";async function o(e){if(!e)throw new Error("Order ID is required");const r=await a("/api/v1/mercadopago/create-preference",{method:"POST",body:JSON.stringify({orderId:e})});return r?.data||r}export{o as c};
>>>>>>>> origin/master:public/assets/mercadoPagoService-DKCFYGrm.js
