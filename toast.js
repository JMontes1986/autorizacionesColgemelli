(function(){
  function getContainer(){
    let c=document.getElementById('toast-container');
    if(!c){
      c=document.createElement('div');
      c.id='toast-container';
      c.className='toast-container';
      document.body.appendChild(c);
    }
    return c;
  }
  function showToast(msg,type){
    const container=getContainer();
    const toast=document.createElement('div');
    toast.className='toast toast-'+(type||'info');
    toast.textContent=msg;
    container.appendChild(toast);
    setTimeout(()=>toast.classList.add('show'),10);
    setTimeout(()=>toast.classList.remove('show'),4000);
    setTimeout(()=>toast.remove(),4500);
  }
  window.toastSuccess=msg=>showToast(msg,'success');
  window.toastError=msg=>showToast(msg,'error');
  window.toastWarning=msg=>showToast(msg,'warning');
  window.toastInfo=msg=>showToast(msg,'info');
})();
