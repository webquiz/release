/*
 * -----------------------------------------------------------------------
 *   mathquiz.js | javascript for controlling mathquiz web pages
 * -----------------------------------------------------------------------
 *
 *   Copyright (C) Andrew Mathas and Donald Taylor, University of Sydney
 *
 *   Distributed under the terms of the GNU General Public License (GPL)
 *               http://www.gnu.org/licenses/
 *
 *   This file is part of the Math_quiz system.
 *
 *   <Andrew.Mathas@sydney.edu.au>
 *   <Donald.Taylor@sydney.edu.au>
 * ----------------------------------------------------------------------
 */

// global varaibles
var currentQ, qTotal, dTotal, currentQuiz, currentResponse=null;
var QuizSpecifications = new Array();
var Discussion = new Array();
var wrongAnswers = new Array();
var correct  = new Array();

// QuizSpecifications will be an array of the expected responses for each question
var QuizSpecifications = new Array();

// specification for the question buttons
blank = {'marker': '',       'color': 'black',  'bg': '#FFF8DC' }
cross = {'marker': '\u2718', 'color': 'red',    'bg': 'linear-gradient(to bottom right, white,  slateblue)' }
star  = {'marker': '\u272D', 'color': 'yellow', 'bg': 'linear-gradient(to bottom right, yellow, green)' }
tick  = {'marker': '\u2714', 'color': 'green',  'bg': 'linear-gradient(to bottom right, red, yellow)' }


var WaitForQuizSpecifications = function(){
  if (QuizSpecifications.length==0) {
    setTimeout(WaitForQuizSpecifications, 15)
  }
}

function MathQuizInit(questions, discussions, quizfile) {
  if (navigator.appName=="Netscape" && parseFloat(navigator.appVersion)<5) {
    alert("Your browser version is " + navigator.appVersion + ".\n" +
          "This quiz is unlikely to work unless your browser version is at least 5.");
  }
  qTotal = questions
  dTotal = discussions
  currentQuiz = quizfile
  currentQ = (dTotal>0) ? -1 : 1

  // read the question specifications for the quiz from <currentQuiz>/quiz_list.js
  document.head.appendChild(document.createElement("script")).src=currentQuiz+'/quiz_list.js';
  WaitForQuizSpecifications();

  // set up arrays for tracking how many times that questions have been attempted
  var i;
  for (i = 0; i < qTotal; i++ ) {
      wrongAnswers[i] = 0; // the number of times the question has been attempted
      correct[i] = false;  // whether or not the supplied answer is correct
  }
}

// Code to hide/show questions

function showQuestion(newQ) { // newQ is an integer which is always in the correct range
  hideResponse();
  // hide the current question
  document.getElementById('question'+currentQ).style.display = 'none';
  if (currentQ>0) {
    document.getElementById('button'+currentQ).classList.remove('button-selected');
  }
  // display the new question and then set currentQ = newQ
  document.getElementById('question'+newQ).style.display = 'block';
  if (newQ>0) {
    document.getElementById('button'+newQ).classList.add('button-selected');
    document.getElementById('question_number').innerHTML = 'Question '+newQ;
  } else {
    document.getElementById('question_number').innerHTML = Discussion[-1-newQ]
  }
  currentQ=newQ;
}

// Code to hide/show responses

function hideResponse() {
  if (currentResponse != null) {
      currentResponse.style.display = 'none';
  }
}

function showResponse(tag) {
  hideResponse()
  currentResponse = document.getElementById(tag);
  currentResponse.style.display = 'block';
}

// if increment==+1 we find the next questions which has not
// been wrongAnswers correctly; if increment==-1 we find the last
// such question
function nextQuestion (increment) {
  if ( currentQ<0 ) {
    if ( increment==1 ) gotoQuestion(1);
    else gotoQuestion(qTotal);
  }
  var q = currentQ ;
  do {
    q=q+increment;
    if (q==0) q=qTotal;
    else if (q>qTotal) q=1;
  } while (q!=currentQ && correct[q-1] );
  if (q==currentQ)
    alert("There are no more unanswered questions");
  else {
    if ( increment==1 ) {
      self.status = 'Question '+q+' is the next unanswered question';
    } else {
      self.status = 'Question '+q+' was the last unanswered question';
    }
    gotoQuestion( q );
  }
}

function updateQuestionMarker() {
  var qnum = currentQ - 1 ;
  if (currentQ<0) return true; // nothing to change in this case
  var button = document.getElementById('button' + currentQ);
  if (correct[qnum]) {
    if (wrongAnswers[qnum] == 0) {
        marker = star;
    } else {
        marker = tick;
    }
  } else {
    if (wrongAnswers[qnum] > 0) {
        marker = cross
    } else {
        marker = blank
    }
  }
  button.style.background = marker.bg;
  button.style.color      = marker.color
  button.setAttribute('content', marker.marker)
}

function gotoQuestion(qnum) {
  updateQuestionMarker();
  showQuestion(qnum);
}

// check to see whether the answer is correct and update the markers accordingly
function checkAnswer() {
  var qnum = currentQ - 1;
  var question = QuizSpecifications[qnum];
  var formObject = document.forms["Q"+currentQ+"Form"];

  if (question.type == "input") {
    if (question.value == parseFloat(formObject.elements[0].value)) {
      correct[qnum] = true;
      showResponse('q'+currentQ+'true');
    }
    else {
      correct[qnum] = false;
      showResponse('q'+currentQ+'false');
    }
  }
  else if (question.type == "single") {
    var checkedAnswer = 0;
    for  (var i = 0; i < question.length; i++ ) {
      if (formObject.elements[i].checked) {
        correct[qnum] = question[i];
        checkedAnswer = i+1;
        break;
      }
    }
    showResponse('q'+currentQ+'response'+checkedAnswer);
  }
  else { // type is "multiple"
    var badAnswer = 0;
    for  (var i = 0; i < question.length; i++ ) {
      if (formObject.elements[i].checked != question[i]) {
        badAnswer = i+1;
        break;
      }
    }
    // fully correct only if badAnswer === 0 
    if (badAnswer > 0) {
      correct[qnum] = false;
      showResponse('q'+currentQ+'response'+badAnswer);
    }
    else {
      correct[qnum] = true;
      showResponse('q'+currentQ+'response0');
    }
  }
  //
  if ( !correct[qnum] ) { wrongAnswers[qnum] += 1; }
  updateQuestionMarker();
}
