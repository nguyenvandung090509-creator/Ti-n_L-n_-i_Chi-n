const SUITS = ["♠", "♣", "♦", "♥"];
const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const PLAYERS = ["Bạn", "Máy 1", "Máy 2", "Máy 3"];

const state = {
  players: [],
  currentPlayer: 0,
  tablePlay: null,
  passesInRound: 0,
  roundStarter: 0,
  selectedIndexes: new Set(),
  gameOver: false,
};

const handEl = document.getElementById("hand");
const playersEl = document.getElementById("players");
const messageEl = document.getElementById("message");
const tablePlayEl = document.getElementById("table-play");
const currentPlayerEl = document.getElementById("current-player");

document.getElementById("play-btn").addEventListener("click", onUserPlay);
document.getElementById("pass-btn").addEventListener("click", onUserPass);
document.getElementById("new-game-btn").addEventListener("click", initGame);

function createDeck() {
  const deck = [];
  for (let r = 0; r < RANKS.length; r++) {
    for (let s = 0; s < SUITS.length; s++) {
      deck.push({ rank: RANKS[r], suit: SUITS[s], rankValue: r, suitValue: s });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function cardPower(card) {
  return card.rankValue * 4 + card.suitValue;
}

function sortCards(cards) {
  cards.sort((a, b) => cardPower(a) - cardPower(b));
}

function initGame() {
  const deck = createDeck();
  shuffle(deck);

  state.players = PLAYERS.map((name) => ({ name, hand: [] }));
  state.tablePlay = null;
  state.passesInRound = 0;
  state.selectedIndexes.clear();
  state.gameOver = false;

  for (let i = 0; i < 52; i++) {
    state.players[i % 4].hand.push(deck[i]);
  }
  state.players.forEach((p) => sortCards(p.hand));

  state.currentPlayer = findPlayerWithThreeSpades();
  state.roundStarter = state.currentPlayer;

  setMessage(`${PLAYERS[state.currentPlayer]} đi trước (có lá 3♠).`);
  render();
  maybeRunBotTurn();
}

function findPlayerWithThreeSpades() {
  return state.players.findIndex((p) => p.hand.some((c) => c.rank === "3" && c.suit === "♠"));
}

function render() {
  renderPlayers();
  renderHand();
  currentPlayerEl.textContent = PLAYERS[state.currentPlayer];
  tablePlayEl.textContent = state.tablePlay
    ? `${formatCards(state.tablePlay.cards)} (${state.tablePlay.type})`
    : "(trống)";
}

function renderPlayers() {
  playersEl.innerHTML = "";
  state.players.forEach((player, index) => {
    const box = document.createElement("div");
    box.className = `player-box ${state.currentPlayer === index ? "current" : ""}`;
    box.innerHTML = `
      <h3>${player.name}</h3>
      <div>Còn lại: <strong>${player.hand.length}</strong> lá</div>
    `;
    playersEl.appendChild(box);
  });
}

function renderHand() {
  const hand = state.players[0].hand;
  handEl.innerHTML = "";
  hand.forEach((card, index) => {
    const btn = document.createElement("div");
    const red = card.suit === "♦" || card.suit === "♥";
    btn.className = `card ${red ? "red" : ""} ${state.selectedIndexes.has(index) ? "selected" : ""}`;
    btn.textContent = `${card.rank}${card.suit}`;
    btn.addEventListener("click", () => {
      if (state.currentPlayer !== 0 || state.gameOver) return;
      if (state.selectedIndexes.has(index)) {
        state.selectedIndexes.delete(index);
      } else {
        state.selectedIndexes.add(index);
      }
      renderHand();
    });
    handEl.appendChild(btn);
  });
}

function getPlayType(cards) {
  if (cards.length === 1) return "single";
  if (cards.length === 2 && cards[0].rank === cards[1].rank) return "pair";
  if (cards.length === 3 && cards.every((c) => c.rank === cards[0].rank)) return "triple";
  return null;
}

function comparePlay(newCards, oldPlay) {
  if (newCards.length !== oldPlay.cards.length) return false;
  const newType = getPlayType(newCards);
  if (newType !== oldPlay.type) return false;

  const topNew = [...newCards].sort((a, b) => cardPower(b) - cardPower(a))[0];
  const topOld = [...oldPlay.cards].sort((a, b) => cardPower(b) - cardPower(a))[0];
  return cardPower(topNew) > cardPower(topOld);
}

function isValidPlay(cards, playerIndex) {
  if (!cards.length) return { ok: false, msg: "Bạn chưa chọn lá nào." };

  sortCards(cards);
  const type = getPlayType(cards);
  if (!type) return { ok: false, msg: "Chỉ hỗ trợ đánh rác, đôi hoặc sám cô." };

  const isFirstMove = state.tablePlay === null && state.players.every((p, i) => i === playerIndex || p.hand.length === 13);
  if (isFirstMove) {
    const hasThreeSpades = cards.some((c) => c.rank === "3" && c.suit === "♠");
    if (!hasThreeSpades) return { ok: false, msg: "Lượt đầu tiên phải chứa 3♠." };
  }

  if (!state.tablePlay || playerIndex === state.roundStarter) return { ok: true, type };
  if (!comparePlay(cards, state.tablePlay)) return { ok: false, msg: "Bài phải cùng kiểu và lớn hơn bài trên bàn." };
  return { ok: true, type };
}

function removeCardsFromHand(hand, cardsToRemove) {
  cardsToRemove.forEach((card) => {
    const idx = hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
    if (idx >= 0) hand.splice(idx, 1);
  });
}

function playCards(playerIndex, cards) {
  const validation = isValidPlay([...cards], playerIndex);
  if (!validation.ok) return validation;

  removeCardsFromHand(state.players[playerIndex].hand, cards);
  state.tablePlay = { cards: [...cards], type: validation.type };
  state.roundStarter = playerIndex;
  state.passesInRound = 0;

  if (state.players[playerIndex].hand.length === 0) {
    state.gameOver = true;
    setMessage(`${PLAYERS[playerIndex]} đã thắng!`);
  } else {
    setMessage(`${PLAYERS[playerIndex]} đánh ${formatCards(cards)}.`);
  }
  return { ok: true };
}

function advanceTurn() {
  if (state.gameOver) return;
  state.currentPlayer = (state.currentPlayer + 1) % 4;
  render();
  maybeRunBotTurn();
}

function passTurn(playerIndex) {
  state.passesInRound += 1;
  setMessage(`${PLAYERS[playerIndex]} bỏ lượt.`);

  if (state.passesInRound >= 3) {
    state.tablePlay = null;
    state.currentPlayer = state.roundStarter;
    state.passesInRound = 0;
    setMessage(`Cả 3 người còn lại đã bỏ lượt. ${PLAYERS[state.currentPlayer]} được ra bài mới.`);
    render();
    maybeRunBotTurn();
    return;
  }
  advanceTurn();
}

function onUserPlay() {
  if (state.currentPlayer !== 0 || state.gameOver) return;
  const hand = state.players[0].hand;
  const cards = [...state.selectedIndexes].map((i) => hand[i]);
  const result = playCards(0, cards);

  if (!result.ok) {
    setMessage(result.msg);
    render();
    return;
  }

  state.selectedIndexes.clear();
  render();
  advanceTurn();
}

function onUserPass() {
  if (state.currentPlayer !== 0 || state.gameOver) return;
  if (!state.tablePlay) {
    setMessage("Bạn không thể bỏ lượt khi bàn đang trống.");
    return;
  }
  passTurn(0);
}

function maybeRunBotTurn() {
  while (!state.gameOver && state.currentPlayer !== 0) {
    botPlay(state.currentPlayer);
  }
}

function botPlay(playerIndex) {
  const hand = state.players[playerIndex].hand;
  const candidate = findBotMove(hand);
  if (!candidate) {
    passTurn(playerIndex);
    return;
  }

  playCards(playerIndex, candidate);
  render();
  if (!state.gameOver) {
    state.currentPlayer = (state.currentPlayer + 1) % 4;
  }
}

function findBotMove(hand) {
  const singles = hand.map((c) => [c]);
  const pairs = [];
  const triples = [];

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (hand[i].rank === hand[j].rank) pairs.push([hand[i], hand[j]]);
      for (let k = j + 1; k < hand.length; k++) {
        if (hand[i].rank === hand[j].rank && hand[j].rank === hand[k].rank) triples.push([hand[i], hand[j], hand[k]]);
      }
    }
  }

  const plays = [...singles, ...pairs, ...triples];
  plays.sort((a, b) => cardPower(a[a.length - 1]) - cardPower(b[b.length - 1]));

  for (const play of plays) {
    if (isValidPlay([...play], state.currentPlayer).ok) return play;
  }
  return null;
}

function formatCards(cards) {
  return cards.map((c) => `${c.rank}${c.suit}`).join(" ");
}

function setMessage(msg) {
  messageEl.textContent = msg;
}

initGame();
