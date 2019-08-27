/**
 * script.js
 */

/* HTML要素の取得 */
let cs = document.getElementById('canvas')
/**
 * @type {CanvasRenderingContext2D}
 */
let ctx = cs.getContext('2d')

let updownRng = document.getElementById('updownRng')
let updownVal = document.getElementById('updownVal')
let resetBtn = document.getElementById('resetBtn')
let plNameTxt = document.getElementById('plNameTxt')
let acvBubbleCbx = document.getElementById('acvBubbleCbx')
let acvBWCbx = document.getElementById('acvBWCbx')
let acvFWCbx = document.getElementById('acvFWCbx')

/* 定数の設定 */
const MAX_FPS = 60
const MSPF = 1000 / 60
const WALL_EDGE = 32
const CAVE_EDGE_DISTANCE = cs.width / (WALL_EDGE - 1 - 1)

/* global変数定義 */
let updownInputVal = 0 
let whileMouseDown = false
let onMouseDown = false
let onMouseUp = false
let mousePos = {x:0,y:0}

/**
 * のこぎり状に領域を塗りつぶす
 * @param {CanvasRenderingContext2D} ctx - コンテキスト２ｄ
 * @param {number} bx - 最初のx座標
 * @param {number} dx - 頂点間のx距離
 * @param {number} fy - 平面な部分のy座標
 * @param {number[]} ay - 頂点のy値配列
 */
function fillSaw(ctx,bx,dx,fy,ay){
  ctx.beginPath()
  let x = bx
  let y = fy
  ctx.moveTo(x, y)
  for (const yi of ay) {
    ctx.lineTo(x, yi)
    x += dx
  } 
  ctx.lineTo(x - dx, y)
  ctx.closePath()
  ctx.fill()
}

/**
 * rangeElementの値を設定する
 * @param {HTMLElement} rangeElement - HTML内のinput range
 * @param {number} min - rangeの最小値
 * @param {number} max - rangeの最大値
 * @param {number} step - 1目盛りごとの変化量
 * @param {number} value - 初期化する値
 */
function setRangeAttribute(rangeElement, min, max, step, value){
    rangeElement.min = min
    rangeElement.max = max
    rangeElement.step = step
    rangeElement.value = value
}

class CaveWall{
  constructor(height, center, height_min, height_max) {
    this.x = 0
    this.height = height
    this.tops = []
    this.bottoms= []
    this.center = center
    this.height_min = height_min
    this.height_max = height_max

    for(let i = 0; i < WALL_EDGE;++i){
      this.generateCave()
    }
  }

    // 壁を1頂点分生成する
  generateCave(){
    /* 壁の追加と削除 */
    while(this.tops.length >= WALL_EDGE){
      this.tops.shift()
    }
    while(this.bottoms.length >= WALL_EDGE){
      this.bottoms.shift()
    }
    this.tops.push(this.center - (this.height / 2))
    this.bottoms.push(this.center + (this.height / 2))

    /* 高さ変更 */
    this.height += (Math.random() - 0.5) * 2 * 20
    // 高さの調節
    this.height = Math.min(this.height, this.height_max)
    this.height = Math.max(this.height, this.height_min)

    /* 中心変更 */
    this.center += (Math.random() - 0.5) * 2 * 20
    // はみ出し対策 
    this.center = Math.min(this.center, cs.height - (this.height / 2))
    this.center = Math.max(this.center, (this.height / 2))
  }

  scroll(dx){
    this.x -= dx
    if(this.x + CAVE_EDGE_DISTANCE <= 0){
      this.x += CAVE_EDGE_DISTANCE
      this.generateCave()
    }
  }
}

class Bubble{
  constructor(count, size_min, size_max, spawn_chance=10, dy_max=0.3) {
    this.count = count
    this.size_min = size_min
    this.size_max = size_max
    this.spawn_chance = spawn_chance
    this.dy_max = dy_max
    this.ax = Array(count)
    this.ay = Array(count)
    this.ar = Array(count)
    this.ady = Array(count)

    for(let i = 0; i < count;++i){
      this.ax[i] = - size_max - 1
      this.ar[i] = 0
    }
  }

  scroll(dx){
    // 移動
    for(let i = 0; i < this.count;++i){
      this.ax[i] -= dx
      this.ay[i] += this.ady[i]
    }

    //生成
    if(Math.floor(Math.random() * this.spawn_chance) == 0){
      for(let i = 0; i <  this.count;++i){
        if(this.ax[i]  < -this.ar[i]){
          this.ar[i] = this.size_min + Math.random() * (this.size_max - this.size_min)
          this.ax[i] = cs.width + this.ar[i]
          this.ay[i] = Math.random() * cs.height
          this.ady[i] = - Math.random() * this.dy_max
          break;
        }
      }
    }
  }

  remove_bubble(index){
    this.ax[index] = - this.size_max - 1
  }
}

function main() {
  /* 各種データ宣言 */
  let game_over = true

  let distance = 0
  let score = 0
  let player = plNameTxt.value
  let scroll_dx = 2

  let cave
  let cave_bkgnd  // 追加装飾
  let cave_front  // 追加装飾

  let bubble      // 追加装飾
  let bubble_orange

  let fish_x = cs.width / 4
  let fish_y =  cs.height / 2
  let fish_dx = 0
  let fish_dy =  0
  let fish_ddy =  0

  const score_board_max = 5
  let score_board = []
  for (let i = 0; i < score_board_max; i++) {
    score_board.push(["O.Sakana",0])
  }
  
  let initialize = ()=>{
    distance = 0
    score = 0
    scroll_dx = 2
    player = plNameTxt.value
  

    // 洞窟の壁
    cave = new CaveWall(200, cs.height / 2, 100, 250)

    if(acvBWCbx.checked)cave_bkgnd = new CaveWall(200, cs.height / 2, 50, 150)
    else cave_bkgnd = null

    if(acvFWCbx.checked)cave_front = new CaveWall(200, cs.height / 2, 200, 350)
    else cave_front = null


    // 泡
    if(acvBubbleCbx.checked)bubble = new Bubble(50, 2, 5)
    else bubble = null

    bubble_orange = new Bubble(10, 5, 5, 50, 0.1)


    // サカナ
    fish_x = cs.width / 4
    fish_y =  cs.height / 2
    fish_dx = 0
    fish_dy =  0
    fish_ddy =  0  

    setRangeAttribute(updownRng, -100, 100, 1, 0)

    updownRng.oninput()
  }

  let doesFishHit = ()=>{
    let fcx = fish_x - cave.x
    let icaveraw = fcx / CAVE_EDGE_DISTANCE 
    let icave = Math.floor(icaveraw)        // fishはicave番と+1の間にいる
    let icave_few = icaveraw - icave        // icaverawの小数部分

  
    let cave_htop = cave.tops[icave] * (1 - icave_few) 
                  + cave.tops[icave + 1] * icave_few
    let cave_hbottom = cave.bottoms[icave] *  (1 - icave_few)
                     + cave.bottoms[icave + 1] * icave_few
    if((cave_htop > fish_y) || (cave_hbottom < fish_y)){
      return true
    }
    return false
  }
  
  let fillFish= (x, y) =>{
      ctx.beginPath()
      ctx.moveTo(x - 10, y)
      ctx.lineTo(x, y + 5)
      ctx.lineTo(x + 10, y)
      ctx.lineTo(x, y - 5)
      ctx.lineTo(x - 10, y)
      ctx.lineTo(x - 15, y + 5)
      ctx.lineTo(x - 15, y - 5)
      ctx.closePath()
      ctx.fill()
  }

  /* 描画関数 */
  let render = () => {

    /* 入力処理+ゲームの経過処理 */
    if(whileMouseDown){
      if(mousePos.y < fish_y){
        updownInputVal= (mousePos.y - fish_y)/ fish_y * 100
      }else{
        updownInputVal = (mousePos.y - fish_y) / (cs.height - fish_y) * 100
      }
    }
    fish_ddy = updownInputVal / 10000

    if(game_over){
      if(onMouseDown){
        initialize()
        game_over = false
      }
    }else{      
      /* 移動による得点追加 */
      if(Math.floor(distance / 100) !== Math.floor((distance + scroll_dx) / 100))score += 1
      distance += scroll_dx

      /* オブジェクトのスクロール */
      cave.scroll(scroll_dx)
      if(cave_bkgnd)cave_bkgnd.scroll(scroll_dx / 2)
      if(cave_front)cave_front.scroll(scroll_dx * 2)
      if(bubble)bubble.scroll(scroll_dx)
      if(bubble_orange)bubble_orange.scroll(scroll_dx)

      /* サカナの移動 */
      fish_dy += fish_ddy
      fish_dy = Math.min(fish_dy, 2)
      fish_dy = Math.max(fish_dy, -2)
      fish_x += fish_dx
      fish_y += fish_dy

      for(let i = 0;i < bubble_orange.count;++i){
        if(Math.pow(bubble_orange.ax[i] - fish_x, 2) + Math.pow(bubble_orange.ay[i] - fish_y, 2) < 100){
          score += 10
          bubble_orange.remove_bubble(i)
        }
      }

      if(doesFishHit()){
        for(let i = 0;i < score_board.length;i++){
          if(score_board[i][1] < score){
            score_board.splice(i,0,[player,score])
            break;
          }
        }
        while(score_board.length > score_board_max){
          score_board.pop()
        }
        game_over = true
      }
    }

    /* 描画処理 */
    ctx.fillStyle = 'blue'
    ctx.fillRect(0, 0, cs.width, cs.height)

    if(cave_bkgnd){
      ctx.fillStyle = 'darkblue'
      fillSaw(ctx, cave_bkgnd.x, CAVE_EDGE_DISTANCE, 0, cave_bkgnd.tops)
      fillSaw(ctx, cave_bkgnd.x, CAVE_EDGE_DISTANCE, cs.height, cave_bkgnd.bottoms)
    }

    ctx.fillStyle = 'orange'
    ctx.beginPath()
    for(let i = 0; i < bubble_orange.count; i++){
      ctx.arc (bubble_orange.ax[i], bubble_orange.ay[i], bubble_orange.ar[i], 0, 2 * Math.PI, false)
      ctx.closePath()
    }
    ctx.fill()

    ctx.fillStyle = 'red' 
    fillFish(fish_x, fish_y)

    if(bubble){
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.beginPath()
      for(let i = 0; i < bubble.count; i++){
        ctx.arc(bubble.ax[i], bubble.ay[i], bubble.ar[i], 0, 2 * Math.PI, false)
        ctx.closePath()
      }
      ctx.fill()
    }
    
    ctx.fillStyle = 'green'
    fillSaw(ctx, cave.x, CAVE_EDGE_DISTANCE, 0, cave.tops)
    fillSaw(ctx, cave.x, CAVE_EDGE_DISTANCE, cs.height, cave.bottoms)

    if(cave_front){
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      fillSaw(ctx, cave_front.x, CAVE_EDGE_DISTANCE, 0, cave_front.tops)
      fillSaw(ctx, cave_front.x, CAVE_EDGE_DISTANCE, cs.height, cave_front.bottoms)
    }

    ctx.font = '20px monospace'
    ctx.fillStyle = 'white'
    ctx.fillText ("Score:" + String(score), 16, 361)
    ctx.fillStyle = 'black'
    ctx.fillText ("Score:" + String(score), 15, 360)
    ctx.fillStyle = 'white'
    ctx.fillText ("Player:" + player, 16, 381)
    ctx.fillStyle = 'black'
    ctx.fillText ("Player:" + player, 15, 380)

    if(game_over){
      ctx.fillStyle = 'yellow'
      ctx.font = '50px monospace'
      ctx.fillText ("GAME OVER", 200, 150)
      ctx.font = '20px monospace'
      ctx.fillText ("Click reset button.", 200, 200)

      let cnt = 0
      for (const high_score of score_board) {
        ++cnt
        ctx.font = '40px monospace'
        ctx.fillText (String(cnt) + ".", 560, cnt * 50 + 85)
        ctx.font = '20px monospace'
        ctx.fillText (high_score[0], 600, cnt * 50 + 70)
        ctx.fillText (high_score[1], 600, cnt * 50 + 90)
      }

    }

    /* 入力機能へのフィードバック */
    if(whileMouseDown){
      updownRng.value = updownInputVal
      updownRng.oninput()
    }
    if(onMouseDown){
      onMouseDown = false
    }
    if(onMouseUp){
      onMouseUp = false
    }
  }

  /* 入力関数 */
  updownRng.oninput = () => {
    updownInputVal = Number(updownRng.value)
    updownVal.innerHTML = updownRng.value
  }

  cs.addEventListener('mousedown', () => {
    onMouseDown = true
    whileMouseDown = true
    
  }, false);
  cs.addEventListener('mouseup', () => {
    onMouseUp = true
    whileMouseDown =false
  }, false);
  cs.addEventListener('mousemove', (e)=>{
    if(whileMouseDown){
      mousePos.x = e.clientX
      mousePos.y = e.clientY
    }
  },false);



  resetBtn.onclick = ()=>{
    initialize()
    game_over = false
  }
  
  /* 描画の初期化・実行 */
  initialize()

  let time_last = performance.now()

  let safe_render = ()=>{
    
    render()

    let time_now = performance.now()

    setTimeout(safe_render, Math.max(0, MSPF - (time_now - time_last)))
    time_last = time_now
  }
  safe_render()
}


main()
