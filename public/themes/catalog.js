export const themes = {
  acrylic: {name:'3D 亚克力',subtitle:'穿过星海，驾驶小飞机在透明棋盘上相遇。',
    names:['红方','绿方','黄方','蓝方'],colors:['#ef4444','#22c55e','#e3cc6d','#3b82f6'],darkColors:['#b91c1c','#15803d','#a88932','#1d4ed8'],
    piece:'飞机',unit:'架',base:'机库',launch:'起飞',lane:'归航道',hit:'击落',flight:'快速穿越',
    load:()=>import('./acrylic.js')},
  cartoon: {name:'2D 卡通',subtitle:'带上四只小伙伴，来一场轻快的草地竞走。',
    names:['红方 · 小兔','绿方 · 青蛙','黄方 · 小猫','蓝方 · 企鹅'],colors:['#e57772','#66ae87','#e8c451','#74a5d3'],darkColors:['#b64f4d','#3f8061','#a98220','#477aa8'],
    piece:'小伙伴',unit:'只',base:'营地',launch:'出发',lane:'回家小路',hit:'送回营地',flight:'快速跨越',
    load:()=>import('./cartoon.js')}
};
export function message(theme,key,{count=0}={}) {
  return ({roll:'轮到你了，点击「掷骰子」',thinking:'电脑正在思考…',choose:`选择一${theme.unit}${theme.piece}，或点击编号按钮`,
    noMove:'本次没有合法动作，即将换手',boost:'停在本色格，额外前进 4 格',flight:`进入${theme.flight}通道`,
    bounce:'先到终点，再按多余点数折返',hit:theme.hit==='击落'?`击落 ${count} 架敌机！`:`将 ${count} 只对手送回营地！`,
    crossHit:theme.hit==='击落'?`穿越中途击落 ${count} 架敌机！`:`跨越途中，将 ${count} 只对手送回营地！`,
    finish:`一${theme.unit}${theme.piece}抵达终点！`,again:'掷出了 6 点，可以再掷一次',error:'对局遇到错误，请返回设置重开'})[key]||key;
}
export function moveLabel(t,m) {
  return m.kind==='launch'?t.launch:m.kind==='bounce'?`到终点后折返至 ${m.to}`:
    m.flight?`${m.boostSteps?.length?'快进后':''}${t.flight}至 ${m.to}`:
    m.kind==='finish'?'抵达终点':m.kind==='boost'?`同色 +4 至 ${m.to}`:`前进至 ${m.to}`;
}
