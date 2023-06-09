import React, { Component } from 'react';
import Web3 from 'web3';
import './App.css';
import { SPT_ABI, SPT_Address } from './config';

class SolahParchiThapGame extends Component {
  constructor(props) {
    super(props);
    this.state = {
      contract: null,
      account: null,
      players: [],
      currentPlayer: '',
      playerParchi: [],
      playerName: '',
      // gameInProgress: false,
      playerWon: '',
      gameOver: false,
      amIinPool: false
    };
  }

  async componentDidMount() {
    console.log("ComponentDidMount() called");

    await this.loadWeb3();
    await this.loadContract();
    await this.fetchGameState();
  }

  setupMetamaskListeners = async () => {
    console.log("setupMetamaskListeners() called");

    if (window.ethereum && window.ethereum.isMetaMask) {
      window.ethereum.on('accountsChanged', this.handleAccountsChanged);

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      this.setState({ account: window.ethereum.selectedAddress || '' });
    }
  };

  handleAccountsChanged = async (accounts) => {
    console.log("hanleAccountChangeCalled(_)", window.ethereum.selectedAddress);
    this.setState({ account: window.ethereum.selectedAddress || '' });
    await this.fetchGameState();
  };

  async loadWeb3() {
    console.log("loadWeb3() called");

    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.enable();

      const web3 = window.web3;

      this.setState({ account: window.ethereum.selectedAddress || '' });
      await this.setupMetamaskListeners();
    } else {
      window.alert("Please install MetaMask to use this application!");
    }
  }

  processedEventIds = [];

  shouldProcessEvent = (eventId) => {
    console.log("shouldProcessEvent(_) called", eventId);

    if (this.processedEventIds.includes(eventId)) {
      return false;
    }
    this.processedEventIds.push(eventId);
    if (this.processedEventIds.length === 1000) {
      this.processedEventIds = [];
    }
    return true;
  }

  async loadContract() {
    console.log("loadContract() called");

    const web3 = window.web3;
    const contract = new web3.eth.Contract(SPT_ABI, SPT_Address);
    this.setState({ contract });
    this.attachEventListeners();
  }

  attachEventListeners = () => {
    console.log("attachEventListener() called");

    const { contract } = this.state;
    if (!contract) return;
    contract.events.PlayerEntered({}, (error, event) => {
      if (error) {
        console.error('Error listening to PlayerEntered event:', error);
        return;
      }

      if (!this.shouldProcessEvent(event.id)) return;

      const name = event.returnValues.name;
      console.log('PlayerEntered: event', name);
      this.setState(prevState => ({
        players: [...prevState.players, name] // Add the new name to the players array
      }));
      this.fetchGameState();
    });

    contract.events.GameStarted({}, (error, event) => {
      if (error) {
        console.error('Error listening to GameStarted event:', error);
        return;
      }

      if (!this.shouldProcessEvent(event.id)) return;

      console.log('GameStarted event');
      this.fetchGameState();

    });

    contract.events.Turn({}, (error, event) => {
      if (error) {
        console.error('Error listening to Turn event:', error);
        return;
      }

      if (!this.shouldProcessEvent(event.id)) return;

      const name = event.returnValues.name;
      console.log('Turn event:', name);
      this.setState({ currentPlayer: name })
    });

    contract.events.ParchiTransfer({}, (error, event) => {
      if (error) {
        console.error('Error listening to ParchiTransfer event:', error);
        return;
      }

      if (!this.shouldProcessEvent(event.id)) return;

      console.log('ParchiTransfer event:', event.returnValues.from, event.returnValues.to);

    });

    contract.events.PlayerWon({}, (error, event) => {
      if (error) {
        console.error('Error listening to PlayerWon event:', error);
        return;
      }

      if (!this.shouldProcessEvent(event.id)) return;

      const playerWon = event.returnValues.name
      console.log('PlayerWon event:', playerWon);
      this.setState({ playerWon })

    });

    contract.events.GameOver({}, (error, event) => {
      if (error) {
        console.error('Error listening to GameOver event:', error);
        return;
      }

      if (!this.shouldProcessEvent(event.id)) return;

      console.log('GameOver event');
      this.setState({ gameOver: true });

    });
  }

  async fetchGameState() {
    console.log("fetchGameState() called");

    const { contract } = this.state;
    if (!contract) return;

    const players = await contract.methods.getPool().call();

    const turn = await contract.methods.turn().call();
    const gameInProgress = turn != 4
    var currentPlayer;
    try {
      currentPlayer = await contract.methods.getTurn().call();
    } catch (error) {
      console.error(error)
    }
    try {
      const playerParchi = await contract.methods
        .showParchi()
        .call({ from: window.ethereum.selectedAddress });
      this.setState({ playerParchi })
    } catch (error) {
      console.error(error)
    }
    try {
      const amIinPool = await contract.methods.amIinPool().call({ from: window.ethereum.selectedAddress })
      this.setState({ amIinPool });
    } catch (error) {
      console.error(error)
      this.setState({ amIinPool: false });
    }

    try {
      const playerName = await contract.methods.myName().call({ from: window.ethereum.selectedAddress });
      this.setState({ playerName: playerName });
      console.log(playerName)
    } catch (error) {
      console.error(error);
      this.setState({ playerName: '' });
    }
    console.log("gameInProgress?", gameInProgress, "playerName", this.state.playerName)
    this.setState({ players, currentPlayer, gameInProgress });
  }


  joinGame = async () => {
    console.log("joinGame() called");

    const { contract, playerName } = this.state;
    if (contract && playerName) {
      try {
        await contract.methods.enterPool(playerName).send({
          from: window.ethereum.selectedAddress,
          value: 10000
        });
      } catch (error) {
        console.error('Error joining the game:', error);
      }
    }
  };

  startGame = async () => {
    console.log("startGame() called");

    const { contract, } = this.state;
    try {
      await contract.methods.startGame().send({ from: window.ethereum.selectedAddress });
      // Game started successfully
    } catch (error) {
      console.error(error);
      // Handle error during game start
    }
  };


  passParchi = async (parchiIndex) => {
    console.log("passParchi() called");

    const { contract } = this.state;
    console.log("Passing parchi with index", parchiIndex)
    if (!contract) {
      return;
    }
    try {
      await contract.methods.passParchi(parchiIndex).send({
        from: window.ethereum.selectedAddress,
      });
      await this.fetchGameState();
    } catch (error) {
      console.error('Error passing parchi:', error);
    }
  };

  claimWin = async () => {
    console.log("claimWin() called");

    const { contract } = this.state;
    if (contract) {
      try {
        await contract.methods.claimWin().send({
          from: window.ethereum.selectedAddress,
        });
      } catch (error) {
        console.error('Error claiming win:', error);
      }
    }
  };

  // isPlayerInPool = (players, playerName) => {
  //   console.log("isPlayerInPool(_, _) called", players, playerName);

  //   for (let i = 0; i < players.length; i++) {
  //     if (playerName === players[i]) {
  //       return true;
  //     }
  //   }
  //   return false;
  // };

  forceEnd = async () => {
    console.log("forceEnd() called");

    const { contract } = this.state;
    if (!contract) return;
    try {
      await contract.methods.forceEndGame().send({ from: window.ethereum.selectedAddress })
      this.fetchGameState();
    } catch (error) {
      console.log(error)
    }
  }
  render() {
    console.log("render() called");

    const {
      players,
      currentPlayer,
      playerParchi,
      playerName,
      gameInProgress,
      playerWon,
      gameOver,
      amIinPool
    } = this.state;


    console.log("playerINPool? :", amIinPool)
    console.log("pool size: ", players.length)

    return (
      <div>
        {
          this.state.account &&
          <div className="container">
            {
              gameOver && playerWon !== '' && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    Winner is {playerWon}
                  </h2>
                  <img
                    src="https://png.pngtree.com/png-clipart/20200224/original/pngtree-gold-medal-vector-metal-realistic-first-placement-achievement-round-medal-with-png-image_5222293.jpg"
                    alt="Winner"
                    style={{ maxWidth: '200px', marginTop: '10px' }}
                  />
                </div>
              )
            }

            {
              (!gameOver || playerWon === '') &&
              <div>
                <h1 className="title">SolahParchiThap Game</h1>

                <div className="players-section">
                  <h2>Pool:</h2>
                  <ul className="players-list">
                    {players.map((player, index) => (
                      <li key={index}>{player}</li>
                    ))}
                  </ul>
                </div>

                {gameInProgress && <h2>Current Turn: {currentPlayer}</h2>}

                {amIinPool && <div className="parchi-tokens-section">
                  <h2>Your Parchi Tokens:</h2>
                  <div className="game-grid">
                    {playerParchi.map((number, index) => (
                      <div className="grid-item" key={index}>
                        <img
                          src={`images\\image-${Math.floor(number / 4)}.png`}
                          alt={`Image ${number}`}
                          onClick={() => {
                            this.passParchi(index)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                }

                {!amIinPool && players.length < 4 && (
                  <div className="join-game-section">
                    <h3>Join the Game:</h3>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => this.setState({ playerName: e.target.value })}
                      placeholder="Enter your name"
                    />
                    <button onClick={this.joinGame}>Join</button>
                  </div>
                )}

                {gameInProgress && (
                  <div className="claim-win-section">
                    <h3>Claim Win:</h3>
                    <button onClick={this.claimWin}>Claim Win</button>
                  </div>
                )}

                {gameInProgress ? (
                  <h2 className="game-status">Game in progress</h2>
                ) : amIinPool && players.length === 4 ? (
                  <button onClick={this.startGame}>Start Game</button>
                ) : (
                  <h2 className="game-status">Waiting for players to join...</h2>
                )
                }
                <div>
                  <button onClick={this.forceEnd}>Force End</button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    );
  }
}

export default SolahParchiThapGame;
