"use strict";

(function(module) {

  /**
   * Gives the amount of attack in a resource string
   * @param {string} receive
   * @return {number} attack
   */
  module.attack = function(receive){
    if (typeof receive == "string"){
      return (receive.match(/x/ig) || []).length;
    } else {
      return 0;
    }
  };

  module.translate = function(str){
    if (typeof str == "string") { 
      return str.toUpperCase().replace("A", "X").replace("C", "R").replace("H","E");
    } else {
      return str;
    }
  };

  function jsonToReplay(json) {
    // console.log(JSON.stringify(json)); // raw json

    const rarity = {
      "trinket"   : 20, 
      "normal"    : 10, 
      "rare"      : 4, 
      "legendary" : 1
    };

    // TODO: Grab this from the replay and remove from here
    const baseSet = [
      "Engineer",
      "Drone", 
      "Conduit", 
      "Blastforge",
      "Animus",
      "Forcefield",
      "Gauss Cannon",
      "Wall",
      "Steelsplitter",
      "Rhino",
      "Tarsier"
    ];

    const endCondition = {
      "-1" : "ENDCON_UNKNOWN",
      "0"  : "ENDCON_RESIGN",
      "1"  : "ENDCON_ELIMINATE",
      "2"  : "ENDCON_TIME",
      "3"  : "ENDCON_NOSHOW",
      "10" : "ENDCON_AGREEDRAW",
      "11" : "ENDCON_FORCEDRAW",
      "12" : "ENDCON_DOUBLENOSHOW",
      "20" : "ENDCON_FAIL",
      "21" : "ENDCON_SUCCEED",
      "30" : "ENDCON_DISCONNECT",
      "31" : "ENDCON_DOUBLEDISCONNECT",
      "32" : "ENDCON_TOOLONG"
    };

    const result = {
      "-10" : "RESULT_UNKNOWN",
      "-1"  : "RESULT_ONGIONG",
      "0"   : "RESULT_WHITE",
      "1"   : "RESULT_BLACK",
      "2"   : "RESULT_DRAW",
      "3"   : "RESULT_ABORT",
      "10"  : "RESULT_RAIDWON",
      "11"  : "RESULT_RAIDLOST"
    };

    var replay = {};

    // Match Info
    replay.json = json;
    replay.code = json.code;
    replay.link = "http://play.prismata.net/?r=" + json.code;
    replay.startTime = new Date(json.startTime * 1000);
    replay.duration = new Date(json.endTime * 1000) - replay.startTime;
    replay.endCondition = endCondition[json.endCondition];
    replay.result = result[json.result];
    replay.turns = Math.ceil((json.commandInfo.clicksPerTurn.length)/2);
    
    replay.timeControls = {};
    replay.timeControls.white = json.timeInfo.playerTime[0].increment;
    replay.timeControls.black = json.timeInfo.playerTime[1].increment;

    // replay.turns = 

    //Unit Info
    replay.gameUnits = [];
    json.deckInfo.mergedDeck.forEach(function(hash){

      var unit = {};

      unit.name     = hash.UIName || hash.name;
      unit.cardText = hash.shortname || unit.name;
      unit.refer    = hash.name;
      
      unit.abilityScript = hash.abilityScript;
      unit.abilityCost   = hash.abilityScript && module.translate(hash.abilityCost) || hash.HPUsed && String(hash.HPUsed) + "HP";
      unit.turnScript    = hash.beginOwnTurnScript;

      unit.cost      = module.translate(hash.buyCost);
      unit.health    = hash.toughness || 1;
      unit.supply    = rarity[hash.rarity];
      unit.buildTime = hash.buildTime || 1;

      unit.blocker   = hash.defaultBlocking == 1;
      unit.stamina   = hash.charge || -1;
      unit.exhaust   = unit.turnScript && unit.turnScript.delay || unit.abilityScript && unit.abilityScript.delay || -1
      unit.prompt    = hash.buildTime === 0;
      unit.fragile   = hash.fragile == 1;
      unit.chill     = hash.targetAction == "disrupt" ? hash.targetAmount : -1;
      unit.lifespan  = hash.lifespan || -1;
      unit.spell     = hash.spell == 1;
      unit.frontline = hash.undefendable == 1;

      // Xaetron, Mahar
      unit.maxHealth = hash.HPMax || unit.health;  
      unit.regen     = hash.HPGained || 0;

      // Trust me, doing this manually is way easier
      unit.sniper = hash.targetAction == "snipe" || hash.abilityNetherfy
      switch (unit.name){
        case "Deadeye Operative":
          unit.snipeCondition = {"unit": ["Drone"]};
          break;
        case "Apollo":
          unit.snipeCondition = {"maxHealth" : 3};
          unit.maxAttack = 3;
          break;
        case "Kinetic Driver":
          unit.snipeCondition = {"unit": ["Animus", "Blastforge", "Conduit"]}
          unit.maxAttack = 3;
          break;
        default:
          break;
      }

      unit.resonate    = hash.resonate; // Amporilla, Resophore 
      unit.description = hash.description || ""; // Deadeye, Apollo, Kinetic Driver

      unit.autoAttack  = typeof unit.turnScript    == 'object' ? module.attack(module.translate(unit.turnScript.receive)) : 0;
      unit.clickAttack = typeof unit.abilityScript == 'object' ? module.attack(module.translate(unit.abilityScript.receive)) : 0;
      unit.maxAttack   = unit.autoAttack + unit.clickAttack;

      replay.gameUnits.push(unit);

    });

    replay.baseSet = replay.gameUnits.filter(function(unit, index, arr){
      return (json.logInfo.rawDeck.baseCards.indexOf(unit.refer) > -1);
      // return (baseSet.indexOf(unit.name) > -1);
    });

    replay.randomSet = replay.gameUnits.filter(function(unit, index, arr){
      return (json.deckInfo.randomizer[0].indexOf(unit.refer) > -1);
    });


    // Player Info
    replay.players = {};

    ["white", "black"].forEach(function setPlayer(color, index, arr){

      this[color] = {};
      
      this[color].name = json.playerInfo[index].displayName;

      this[color].winner = false;
      if (index == json.result){
        this[color].winner = true;
        replay.winner = color;
      }

      this[color].timeControl = json.timeInfo.playerTime[index].increment;

      this[color].skins = {};
      for (var unit in json.deckInfo.skinInfo){
        if (json.deckInfo.skinInfo.hasOwnProperty(unit)){
          this[color].skins[unit] = json.deckInfo.skinInfo[unit][index]; 
        }
      }

      this[color].ratingInitial = Math.floor(json.ratingInfo.initialRatings[index].displayRating);
      this[color].ratingFinal   = json.ratingInfo.finalRatings[index];
      this[color].ratingChange  = json.ratingInfo.ratingChanges[index];
      this[color].tier          = json.ratingInfo.initialRatings[index].tier;

    }, replay.players);

    return replay;
  }

  function validate_code(replay_code){
    return /^[a-z0-9@+]{5}-[a-z0-9@+]{5}$/i.test(replay_code);
  }
  
  function url_encode(str){
    return str.replace("+", "%2B");
    // return encodeURI(str);
  }


  module.getReplay = function(replay_code, cb) {
    
    if(!validate_code(replay_code)){
      console.log("Invalid replay code");
      return cb(new Error("Invalid replay code"));
    }
  
    const formatted_code = url_encode(replay_code);
    const uri = "http://saved-games-alpha.s3-website-us-east-1.amazonaws.com/" + formatted_code + ".json.gz";
  
    var xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    xhr.responseType = 'blob';
    
    xhr.onload = function(e) {
      if (this.status == 200) {
        var blob = this.response;
        var reader = new window.FileReader();
        reader.readAsDataURL(blob); 
    
        reader.onloadend = function() {
          var base64data = reader.result;   
          base64data = base64data.replace("data:application/octet-stream;base64,", '');   
          const decompressed_text = JXG.decompress(base64data);

          if (!decompressed_text) {
            return cb(new Error("Non-extant replay (could not decode payload)"));
          } else {
            return cb(false, jsonToReplay(JSON.parse(decompressed_text)));
          }        
        };
    
      } else {
        return cb(new Error("AWS did not respond successfully"));
      }
    };

    xhr.onerror = function(error){
      return cb(new Error("Unknown error during ajax request: " + error.message));
    };

    xhr.send();
  };
})(window.PrismataReplay = {});


window.addEventListener("load", function() {
  console.log("PrismataReplay test");

  PrismataReplay.getReplay("2v6uK-b2cEK", function(err, replay) {
    if (err) {
      console.log("Got error :(");
      console.log(err);
    } else {
      console.log("User plugin works!");
      console.log (replay);
    }
  });
}, false);

