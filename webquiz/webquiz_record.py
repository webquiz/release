#!/usr/bin/env python3

r'''
------------------------------------------------------------------------------
    webquiz_record | Online quizzes generated from LaTeX using python and TeX4ht
                   | Example cgi script for recording quiz results
------------------------------------------------------------------------------
    Copyright (C) Andrew Mathas, University of Sydney

    Distributed under the terms of the GNU General Public License (GPL)
                  http://www.gnu.org/licenses/

    This file is part of the WebQuiz system.

    <Andrew.Mathas@sydney.edu.au>
------------------------------------------------------------------------------
'''

import base64
import fcntl
import json
import os
import sys

# Start sending a response back to the quiz page
print("Content-Type: application/json\n")

try:
    # Read content length from header
    content_length = int(os.environ.get("CONTENT_LENGTH", 0))
    if content_length == 0:
        raise ValueError("No data received.")

    # Read raw POST data
    raw_data = sys.stdin.read(content_length)

    # Parse JSON
    results = json.loads(base64.b64decode(raw_data.encode()))

    # Append results to the csv file
    quiz_file = os.path.join('results', results['quiz']+'.csv')
    new_file = not os.path.isfile(quiz_file)

    with open(quiz_file, 'a') as quiz:
        # lock the file -- and wait if it is locked
        fcntl.flock(quiz, fcntl.LOCK_EX)
        try:
            # if the file does not exist then start with the headers
            if new_file:
                quiz.write(results['headers']+'\n')
            # now add the results for the current student
            quiz.write(results['results']+'\n')

        finally:
            # Unlock, even if write fails
            fcntl.flock(quiz, fcntl.LOCK_UN)

    # complete the response by reporting success
    print(json.dumps({"status": "success", "message": "Data saved"}))

except Exception as e:
    # complete the response by reporting an error
    print(json.dumps({"status": "error", "message": str(e)}))
