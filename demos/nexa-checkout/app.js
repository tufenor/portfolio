const tabs=[...document.querySelectorAll('.screen-tab')];
const panels=[...document.querySelectorAll('[data-panel]')];
const count=document.getElementById('screen-count');
const toast=document.getElementById('toast');
let toastTimer;
const showToast=(message)=>{toast.textContent=message;toast.classList.add('is-shown');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('is-shown'),3200)};
function setScreen(name,focusPanel=false){
  const index=tabs.findIndex(tab=>tab.dataset.screen===name);
  if(index<0)return;
  tabs.forEach((tab,i)=>{const active=i===index;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1});
  panels.forEach(panel=>{const active=panel.dataset.panel===name;panel.hidden=!active;panel.classList.toggle('is-visible',active)});
  count.textContent=String(index+1).padStart(2,'0');
  if(focusPanel)panels[index].focus({preventScroll:true});
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>setScreen(tab.dataset.screen));
  tab.addEventListener('keydown',(event)=>{
    if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].focus();setScreen(tabs[next].dataset.screen);
  });
});
document.querySelectorAll('.method-card').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.method-card').forEach(card=>{const selected=card===button;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected))});
  document.getElementById('pay-button').innerHTML=`Continuar com ${button.dataset.method==='pix'?'Pix':'cartão'} <span aria-hidden="true">→</span>`;
}));
document.getElementById('pay-button').addEventListener('click',()=>showToast('Demonstração: nenhum pagamento foi processado.'));
document.getElementById('login-form').addEventListener('submit',(event)=>{event.preventDefault();showToast('Acesso demonstrativo: nenhuma conta foi consultada.');});
document.getElementById('forgot-link').addEventListener('click',(event)=>{event.preventDefault();showToast('Fluxo demonstrativo de recuperação de acesso.');});
document.getElementById('signup-button').addEventListener('click',()=>showToast('Fluxo demonstrativo de criação de conta.'));
document.querySelectorAll('[data-toast]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.toast)));
