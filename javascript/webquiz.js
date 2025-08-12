/* ----------------------------------------------------------------------
 *   webquiz.js | javascript for controlling webquiz web pages
 * -----------------------------------------------------------------------
 *
 *   Copyright (C) Andrew Mathas, University of Sydney
 *
 *   Distributed under the terms of the GNU General Public License (GPL)
 *               http://www.gnu.org/licenses/
 *
 *   This file is part of the WebQuiz system.
 *   <Andrew.Mathas@sydney.edu.au>
 *
 * ----------------------------------------------------------------------
 *   Partly based on earlier code by Donald Taylor
 *   Substatially rewriten for /
 */

// ----------------------------------------------------------------------
// All of the data for the quiz is stored in the WQ object. We wrap the
// data inside a function to make it more difficiult to access the data
// from the javascript console.
let WQ =(function(){
    // private data that we do not want to share
    const quiz = {
        answers:        [],    // student data
        attempts:       [],    // number of times that the question has been attempted
        buttonOrder:    [],    // map from button number to question number
        correct:        [],    // questions answered correctly
        feedback:       true,  // showing feedback
        finishingTime:  null,  // time quiz should end
        markingApi:     null,  // URL of the API that will receive the results
        onePage:        false, // true if all questions are displayed on a single page
        questionOrder:  [],    // map from question number to button number
        questions:      [],    // the quiz questions
        store: 'localStorage', // WebQuiz store
        submitted:      false, // record whether we have submitted, so we don't submit twice
    };

    // public methods
    const button = (b) => { return buttonOrder[b] };
    const cannotSet = (prop) => { console.log('WARNING: unable to set '+prop) };
    const eat = (food) => { for (const [key, value] of Object.entries(read(food)) ) { quiz[key]=value } };

    // return the public facing data
    return {
        currentB:              0,     // current button number
        currentFeedback:       null,  // feedback currently being displayed
        currentQ:              0,     // current question number
        discussions:           [],    // the discussions
        quizIndex:             [],    // Titles for the quiz index
        quizIndexCreated:      false, // stop the dropdown menu from being created twice
        sideMenuOpen:          true,  // side menu is open by default

        // getters
        get onePage()          { return quiz.onePage },
        get feedback()         { return quiz.feedback },
        get finishingTime()    { return quiz.finishingTime },
        get markingApi()       { return quiz.markingApi },

        // setters : prevent the user from changing internal settings
        set answers(val)       { cannotSet('answers')        },
        set attempts(val)      { cannotSet('attempts')       },
        set correct(val)       { cannotSet('correct')        },
        set feedback(val)      { cannotSet('feedback')       },
        set finishingTime(val) { cannotSet('finishing time') },
        set markingApi(val)    { cannotSet('markingApi')     },
        set onePage(val)       { cannotSet('onePage')        },
        set questions(val)     { cannotSet('questions')      },

        // other WebQuiz methods that use the private quiz data
        manna:                 eat,
        button:                button,
    }
})()

// ----------------------------------------------------------------------
// Translations
const Words = {
    noMore:        'There are no more unanswered questions',    // string used in alerts
    pleaseAnswer:  'Please answer the question first',    // string used in alerts
}

// ----------------------------------------------------------------------


// create the drop down menu dynamically using the WQ.quizIndex array
function createQuizIndexMenu() {
    if ( !WQ.quizIndexCreated ) {
      // add the menu icon for the quizzes menu - only called if there is at least one quiz
      document.getElementById("quizzes-menu-icon").innerHTML = " &#9776;";

      var max = 0, q, quiz_link, menu = document.createDocumentFragment();
      for (q = 0; q < WQ.quizIndex.length; q++) {
          quiz_link = document.createElement("li");
          quiz_link.innerHTML = '<a href="' + WQ.quizIndex[q][1] + '">' + WQ.quizIndex[q][0] + '</a>';
          menu.appendChild(quiz_link);
          max = Math.max(max, WQ.quizIndex[q][0].length);
      }
      WQ.quizIndexMenu.style.width = Math.round(max) + "ex";
      WQ.quizIndexMenu.appendChild(menu);
      WQ.quizIndexCreated = true;
    }
}

// create an event listener so that we can close the drop-down menu
// whenever some one clicks outside of it
function MenuEventListener(evnt) {
    var menu_icon = document.getElementById('quizzes-menu-icon');
    if (WQ.quizIndexMenu.contains(evnt.target)) {
      return; // inside the menu so just return
    } else {   // outside the menu so check the number of menu_clicks
      if (WQ.quizIndexMenu.style.display === 'block' || menu_icon.contains(evnt.target)) {
        evnt.stopPropagation();
        toggleQuizIndexMenu();
      }
    }
}

// toggle the display of the side menu that contains the question numbers
function toggleQuizIndexMenu() {
    if (WQ.quizIndexMenu.style.display === 'block') {
      WQ.quizIndexMenu.style.display = 'none';
    } else {
      WQ.quizIndexMenu.style.display = 'block';
      window.addEventListener('click', MenuEventListener, true);
    }
}

// show or hide the sidemenu
function showSideMenu() {
    if ( WQ.sideMenuOpen ) {
        WQ.sideMenu.style.display = "block";
        WQ.sideOpen.style.display = "block";
        WQ.sideClosed.style.display = "none";
    } else {
        WQ.sideMenu.style.display = "none";
        WQ.sideOpen.style.display = "none";
        WQ.sideClosed.style.display = "block";
    }
}

// toggle the display of the side menu and its many associated labels
function toggleSideMenu() {
    W.sideMenuOpen = ! WQ.sideMenuOpen
    showSideMenu()
    // remember whether the side menu is open or closed
    saveQuizData()
}

// ----------------------------------------------------------------------
// ??? implement a dynamic theme switcher
// ??? should be coupled with a drop-down menu as in theme_menu in webquiz_templates
// var theme_menu            // handler for the theme_menu
// function toggleThemeMenu() {// unused
//     if (theme_menu.style.display === 'block') {
//       theme_menu.style.display = 'none';
//     } else {
//       theme_menu.style.display = 'block';
//       window.addEventListener('click', MenuEventListener, true);
//     }
// }

// Code to hide/show questions
function showQuestion(newB, newQ) { // newQ is an integer which is always in the WQ.correct range
console.log('showQuestion('+newB+', '+newQ+')')
    if (!WQ.onePage) {
      // hide the current question and feedback
      if (newQ!=WQ.currentQ && WQ.currentQ!=0) {
            hideFeedback();
            document.getElementById("question" + WQ.currentQ).style.display = "none";
            // "de-select" the current button
            WQ.currentB.classList.remove("button-selected");
      }
      // display the new question
      document.getElementById("question" + newQ).style.display = "table";

      // update the question/discussion header and select question button
      if (newQ > 0) {
          document.getElementById("question-label").style.display = 'contents';
          document.getElementById("question-number").innerHTML = String(newB);
      } else {
          document.getElementById("question-label").style.display = 'none';
          document.getElementById("question-number").innerHTML = WQ.discussions[-newQ];
      }
      // set WQ.currentB = the current button and "select" the current button
      WQ.currentB = document.getElementById("button" + newB);
      WQ.currentB.classList.add("button-selected");
    }

    // finally set WQ.currentQ = current question
    WQ.currentQ = newQ;
}

// ----------------------------------------------------------------------
// Code to hide/show feedback

function hideFeedback() {
    if (WQ.currentFeedback) {
        WQ.currentFeedback.style.display = "none";
    }
}

// show the feedback for the question unless the quiz is timed
function showFeedback(tag) {
console.log('showFeedback: tag='+tag+', current feedback='+WQ.currentFeedback)
    if ( !WQ.finishingTime ) {
        hideFeedback(); // hide current feedback
        WQ.currentFeedback = document.getElementById(tag);
        if ( WQ.currentFeedback ) {
            WQ.currentFeedbackTag = tag;
            WQ.currentFeedback.style.display = "block";
        }
    }
}

// if increment==1 we find the next questions that has not
// been answered incorrectly and if increment==-1 we find the last
// such question
function nextQuestion(increment) {
console.log('nextQuestion('+increment+')')
    if (WQ.currentQ < 0) { // a discussion item => go to either first or last question
        if (increment === 1) {
            gotoQuestion(1);
        } else {
            gotoQuestion(WQ.qTotal);
        }
    } else {
        var b = WQ.button(WQ.currentQ), q;
        do {
            b += increment;
            if (b === 0) {
                b = WQ.qTotal;
            } else if (b > WQ.qTotal) {
                b = 1;
            }
            q = WQ.questionOrder[b];
        } while (q !== WQ.currentQ && (!WQ.feedback || WQ.correct[q]) );
        if (b === WQ.currentB) {
            alert(Words.noMore);
        } else {
            gotoQuestion(b);
        }
    }
}


// ----------------------------------------------------------------------
// Specification for the question buttons for use in updateQuestionMarker
const  buttons = ['answered', 'blank', 'cross', 'star', 'tick'];
const  answered = {
    "content": "",
    "name": "answered"
};
const blank = {
    "content": "",
    "name": "blank"
};
const cross = {
    "content": "\u2718",
    "name": "cross"
};
const star = {
    "content": "\u272D",
    "name": "star"
};
const tick = {
    "content": "\u2714",
    "name": "tick"
};

function updateQuestionMarker(bnum, qnum) {
    // here qnum is assumed to be the question number in the web form
    if (WQ.feedback && qnum > 0) {
        var marker = blank;
        var button = document.getElementById('button'+bnum);
        if ( WQ.finishingTime ) { // don't update WQ.correct and incorrect markers if timing quiz
            if (WQ.correct[qnum] || WQ.attempts[qnum]>0) {
              marker = answered;
            }
        } else {
            if (WQ.correct[qnum]) {
                if (WQ.attempts[qnum] === 0) {
                    marker = star;
                } else {
                    marker = tick;
                }
            } else if (WQ.attempts[qnum] > 0) {
                marker = cross;
            }
        }
        for (var b = 0; b < buttons.length; b++) {
           button.classList.remove(buttons[b]);
        }
        button.classList.add(marker.name);
        button.setAttribute("content", marker.content);
    }
}

// jumps to a chosen question and pushes the number of this question to the browser history
function gotoQuestion(bnum) {
console.log('gotoQuestion('+bnum+')')
    // bnum is a button number so we need to convert to a question number

    var qnum = (bnum>0) ? WQ.questionOrder[bnum] : bnum;
    gotoQuestionHelper(qnum);
    history.pushState(qnum, '', '');
}

// jumps to the specified question (without pushing it to the browser history)
function gotoQuestionHelper(qnum) {
    var bnum = (qnum>0) ? WQ.button(qnum) : qnum;
    updateQuestionMarker(bnum, qnum);
    showQuestion(bnum, qnum);
}

// ----------------------------------------------------------------------
// dictionary of comparison methods for when question.type=='input'
// each function in the dictionary returns true or false
var compare = {
  'complex': function(ans, val) {// check real and imaginary parts
               var a = math.complex(ans);
               var b = math.complex(val);
               return a.re==b.re && a.im==b.im;
             },
  'integer': function(ans, val) {// compare as integers
               return parseInt(val)==parseInt(ans);
             },
  'lowercase':  function(ans, val) {//convert to lowercase string and compare
               return val==String(ans).toLowerCase();
             },
  'number':  function(ans, val) {// compare as numbers
               return math.eval(val)==math.eval(ans);
             },
  'string':  function(ans, val) {// compare as strings
               return val==String(ans);
             }
};

// check to see whether the answer is WQ.correct and update the markers accordingly
function checkAnswer(qnum) {
    var question = WQ.questions[qnum];
    var studentAnswer = document.forms["Q" + qnum + "Form"];
    var i;
    console.log('checking qnum='+qnum+', question: '); console.log(question);
    switch (question.type) {
        case "input":
            var answer = studentAnswer.elements[0].value;
            if (answer=='') { // must have hit checkAnswer without answering, so ignore
              alert(Words.pleaseAnswer);
              return;
            }
            try {
              WQ.correct[qnum] = compare[question.comparison](answer, question.answer);
            } catch(err) {
              WQ.correct[qnum] = false;
            }
            if (WQ.correct[qnum]) {
                showFeedback("q" + qnum + "true");
            } else {
                showFeedback("q" + qnum + "false");
            }
            // record the student's answer
            WQ.student[qnum] = studentAnswer.elements[0].value
            break;

        case "single":
            var checkedAnswer = 0;
            if ( studentAnswer.elements[ WQ.questions[qnum].answer ].checked ) {
                WQ.correct[qnum] = true
                WQ.student[qnum] = WQ.questions[qnum].answer
                checkedAnswer = WQ.student[qnum]+1
            } else {
                for (i = 0; i < question.answer.length; i++) {
                    if (studentAnswer.elements[i].checked) {
                        // this is incorrect
                        WQ.correct[qnum] = false
                        WQ.student[qnum] = i
                        checkedAnswer = i + 1;
                        break;
                    }
                }
            }
            if ( checkedAnswer == 0 ) { alert(Words.pleaseAnswer); break; }
            showFeedback("q" + qnum + "feedback" + checkedAnswer);
            break;

        case "multiple":
            var badAnswers = [], answered=false;

            var selected = []
            WQ.student[qnum] = []
            for (i = 0; i < question.answer.length; i++) {
                if ( studentAnswer.elements[i].checked ) {
                    WQ.student[qnum].push(i)
                    if ( !WQ.questions[qnum].answer.includes(i) ) {
                        badAnswers.push(i)
                    }
                } else if (WQ.questions[qnum].answer.includes(i+1)) {
                        badAnswers.push(i)
                }
            }
            // if no answer then return
            if ( WQ.student[qnum]==[] ) { alert(Words.pleaseAnswer); break; }
            WQ.correct[qnum] = badAnswers==[]
            // fully WQ.correct only if badAnswers == []
            if (badAnswers == []) {
                showFeedback("q" + qnum + "feedback0");
            } else {
                // randomly display feedback for one of incorrect choices
                showFeedback("q" + qnum + "feedback" + badAnswers[Math.floor(Math.random() * badAnswers.length)]);
            }
            break;

        default:
            alert('This should not happen!! Unknown question type: '+question.type);
            break;
    }
    //
    if (!WQ.correct[qnum]) {
        WQ.attempts[qnum] += 1;
    }
    updateQuestionMarker(WQ.button(qnum), qnum);
    saveQuizData();
}

/**
 * Shuffle the WQ.questionOrder array and make WQ.buttonOrder its inverse
 * Based on https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
 */
function shuffleQuestions() {
    var i, j, qi;
    for (i = WQ.questionOrder.length-1; i > 0; i--) {
        j = 1+Math.floor(Math.random() * i);
        qi = WQ.questionOrder[i];
        WQ.questionOrder[i] = WQ.questionOrder[j];
        WQ.questionOrder[j] = qi;
    }
    // ...and compute the inverse map
    for (i = WQ.qTotal - 1; i > 0; i--) {
        WQ.button(WQ.questionOrder[i]) = i;
    }
}

// ----------------------------------------------------------------------
// initialise the quiz, loading specifications and setting up the first question
function webQuizInit(questions, discussions, quizName) {
    // process init options

    // callback for browser history events
    window.addEventListener('popstate', function(e) {
       gotoQuestionHelper(e.state);
    });

    if ( window[WQ.store].getItem(WQ.quizName) !== null) {
        return
    }

    WQ.quizName = quizName
    WQ.qTotal   = questions || 0;
    WQ.dTotal   = discussions || 0;

    // remove question arrows when there are no questions
    if ( WQ.qTotal==0 ) {
        try { document.getElementById('arrows').style.display='none'; }
        catch(err){}
    }

    // display the first question or discussion item
    var newQ = (WQ.dTotal > 0) ? -1 : 1;

    // set up arrays for tracking how many times the questions have been attempted
    var i;
    for (i = 0; i < WQ.qTotal+1; i++) {
        WQ.attempts[i] = 0;    // the number of times the question has been attempted
        WQ.correct[i] = false;     // whether or not the supplied answer is WQ.correct
        WQ.questionOrder[i] = i;   // will determine the order of the questions
        WQ.button(i) = i;     // will determine the order of the buttons
    }

    // read the question specifications for the quiz
    // and then wait for the WQ.questions to load
    var script = document.createElement('script');
    script.src =  WQ.quizName + "/wq-" + WQ.quizName + ".js";
    script.type = "text/javascript";
    document.head.appendChild(script);

    // compute these only once
    WQ.sideMenu   = document.getElementById('side-menu');
    WQ.sideOpen   = document.getElementById('side-label-open');
    WQ.sideClosed = document.getElementById('side-label-closed');
    WQ.quizIndexMenu = document.getElementById("quiz-index-menu");
    showSideMenu()

    // make the drop down menu if WQ.quizIndex contains any entries
    if (WQ.quizIndex.length > 0 && WQ.quizIndexMenu) {
        createQuizIndexMenu();
    }

    window.status = 'webquiz_initialised'
}

// ----------------------------------------------------------------------
// Restores the state of the question markers from local storage
function initSession(timeLimit) {
console.log('initSession')
    if ( window[WQ.store].getItem(WQ.quizName) === null) {
        WQ.timeLimit = timeLimit
        eval(read(wq));
        if ( WQ.timeLimit > 0 ) {
            document.getElementById('quiz-timer').innerHTML = WQ.timeLimit+':00'
        }
        gotoQuestion(1);
    } else {
        // reloading existing session
        //WQ = read(window[WQ.store].getItem(WQ.quizName))

        // need to reallocate
        WQ.sideMenu      = document.getElementById('side-menu');
        WQ.sideOpen      = document.getElementById('side-label-open');
        WQ.sideClosed    = document.getElementById('side-label-closed');
        WQ.quizIndexMenu = document.getElementById("quiz-index-menu");
        WQ.currentB      = document.getElementById("button" + WQ.currentQ);
        if ( WQ.currentFeedbackTag ) {
            WQ.currentFeedback = document.getElementById(WQ.currentFeedbackTag);
        } else {
            WQ.currentFeedback = null;
        }

        // toggle side menu if it supposed to be closed
        showSideMenu()

        // make the drop down menu if WQ.quizIndex contains any entries
        if (WQ.quizIndex.length > 0 && WQ.quizIndexMenu) {
            WQ.quizIndexCreated = false;
            createQuizIndexMenu();
        }

        // update the answers to the quiz
        var q,i; // question counter
        for (var q = 0; q < WQ.qTotal+1; q++) {
            if ( WQ.student[q] ) {
                updateQuestionMarker(WQ.button(q),q);
                var studentAnswer = document.forms["Q" + q + "Form"];
                switch (WQ.questions[q].type) {
                    case "input":
                        studentAnswer.elements[0].value = WQ.student[q];
                        break
                    case "single":
                        studentAnswer.elements[ WQ.student[q]].checked = true
                        break;
                    case "multiple":
                        for (i = 0; i < WQ.questions[q].answer.length; i++) {
                            studentAnswer.elements[i].checked = WQ.student[q].includes(i);
                        }
                        break;
                    default:
                        alert('This should not happen!! Unknown question type: '+WQ.questions[q].type);
                        break;
                }
            }
        }

        // if studentID is set, then then quiz has started
        if ( WQ.studentID ) {
            restartQuiz() 

            // make the browser history remember the first question
            var qnum = (WQ.dTotal > 0) ? -1 : WQ.questionOrder[WQ.currentQ];
            history.replaceState(qnum, null, null);
        }
    }
}


// Start the quiz -- called from the starting page.
// The `msg` says 'Please give your name before starting the quiz' in
// the language of the quiz
function startQuiz(msg) {
console.log('startQuiz')
    // record student ID
    const startingPage = document.forms[0] // the form is the form for the starting page
    WQ.studentID = startingPage.elements[0].value;
    if (!WQ.studentID) {
        alert(msg)
        return false
    }

    // set finishing time
    if ( WQ.timeLimit > 0 ) {
        WQ.finishingTime = new Date()
        WQ.finishingTime.setMinutes(WQ.finishingTime.getMinutes()+WQ.timeLimit);
    }

    // store the finishing time
    saveQuizData()

    restartQuiz()

   // return false so that the form does not submit, which causes the page to reload!
   return false
}

// restart the quiz after reloading the page 
function restartQuiz() {
    // start the timer
    if ( WQ.timeLimit>0 ) { updateQuizTimer(); }

    // hide the starting page and check visibility of the questions
    document.getElementById('starting-page').style.display = 'none'

    // display the submit button
    document.getElementById('submit-button').style.display = 'inline'

    if (WQ.onePage) {
        // set the displays of all questions to inline
        for (q = 1; q < WQ.qTotal+1; q++) {
            document.getElementById('question'+q).style.display = 'inline';
            if (WQ.student[q]) {
                // an answer already exists for this question, so update it
                document.forms["Q"+q+ "Form"].elements[0].value = WQ.student[q];
            }
        }
    } else {
        gotoQuestion(WQ.currentQ)
    }

}

// update the quiz timer
function updateQuizTimer() {
console.log('updateQuizTimer')
    var now = new Date()
    if ( now < WQ.finishingTime ) {
        var remaining = WQ.finishingTime - now;
        var seconds = ('0' + Math.floor((remaining / 1000) % 60)).slice(-2);
        var minutes = ('0' + Math.floor((remaining / 1000 / 60) % 60)).slice(-2);
        var hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
        if ( !WQ.quizTimer ) {
            WQ.quizTimer = document.getElementById('quiz-timer');
        }
        if (hours > 0) {
            WQ.quizTimer.innerHTML = hours + ':' + minutes + ':' + seconds;
        } else {
            WQ.quizTimer.innerHTML = minutes + ':' + seconds;
        }
        // update the quiz timer every second
        setTimeout(updateQuizTimer, 1000);

    } else if ( window[WQ.store].getItem(WQ.quizName ) !== null) {
        // submit provided that we have actually started the quiz
        console.log('Finishing at '+WQ.finishingTime.toLocaleString()+', now = '+Date())
        submitQuiz();
    }
}

// save data for the current quiz and student to localStorage
function saveQuizData() {
console.log('saveQuizData')
    window[WQ.store].setItem(WQ.quizName, write(WQ))
}

async function submitQuiz(msg='') {
console.log('submitQuiz')
    // if WQ.markingApi exists then use a POST request to put the quiz results
    if ( WQ.markingApi && !WQ.submitted && WQ.quizTimer) {

        // ask for confirmation when they submit more than two minutes early
        var now = new Date()
        if ( msg && (WQ.finishingTime-now)/60000 > 2 ) {
            if ( ! confirm(msg) ) { return }
        }

        // prepare the data to send
        var headers='Student', results=WQ.studentID, total=0;
        for (var q=1; q <= WQ.qTotal; q++) {
            headers += ', Q'+q
            if ( WQ.correct [q] ) {
                total += 1
                results += ', 1'
            } else {
                results += ', 0'
            }
        }
        headers += ', Total'
        results += ', '+total
        const data = {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-type': 'application/json; charset=UTF-8'
            },
            body: btoa(JSON.stringify({
              'quiz':    WQ.quizName,
              'ID':      WQ.studentID,
              'headers': headers,
              'results': results
            }))
        }
        // send a POST request to WQ.markingApi
        await fetch(WQ.markingApi, data)
        .then ( response => {
            if (!response.ok) {
              // Handle HTTP errors
              // TODO: adjust language
              alert(response.message+'. Please send '+data.body+' to your unit administrator')
              throw new Error(`HTTP error! Status: ${response.status}`);
            } else {
                console.log('Success:', response.json()['message']);
                WQ.submitted = true

                // remove the timer and the sumit button
                WQ.finishingTime = now;
                WQ.quizTimer.innerHTML = '';
                document.getElementById('quiz-timer-submit').style.display = "none";
            }
        })
      .catch(error => {
        // Tell the student that we could not submit their results
        console.error('Request failed:'+ error.message);
        alert(error.message+'. Please send '+data.body+' to your unit administrator')
      })
    }
}
