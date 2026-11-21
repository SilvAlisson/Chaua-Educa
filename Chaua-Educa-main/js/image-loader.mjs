// Bound both transfer and decoding. A failed attempt never publishes a partial cache.
export function loadImage(url,{width,height,errorMessage=`Não foi possível carregar a imagem: ${url}`,timeoutMs=20000}={}) {
 return new Promise((resolve,reject)=>{
  const image=new Image();let settled=false;
  const finish=(error)=>{
   if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;
   if(error){image.src='';reject(error);}else resolve(image);
  };
  const timer=setTimeout(()=>finish(new Error(`${errorMessage} · tempo limite de carregamento/decodificação`)),timeoutMs);
  image.onerror=()=>finish(new Error(errorMessage));
  image.onload=async()=>{
   if(settled)return;
   if(!image.naturalWidth||!image.naturalHeight||(width&&image.naturalWidth!==width)||(height&&image.naturalHeight!==height)){
    finish(new Error(`${errorMessage} · dimensões inválidas`));return;
   }
   try{if(typeof image.decode==='function')await image.decode();finish();}
   catch(error){finish(new Error(`${errorMessage} · falha de decodificação`,{cause:error}));}
  };
  image.src=url;
 });
}
