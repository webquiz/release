#!/usr/bin/env python3

r'''
-----------------------------------------------------------------------------
    makeimages | extract images from webquiz web pages for the manual
-----------------------------------------------------------------------------

    Copyright (C) Andrew Mathas, University of Sydney

    Distributed under the terms of the GNU General Public License (GPL)
                  http://www.gnu.org/licenses/

    This file is part of the WebQuiz system.

    <Andrew.Mathas@sydney.edu.au>
-----------------------------------------------------------------------------

Python script to extract png images for the various web pages that are in the
webquiz manual. We first use
    - webquiz to construct the web page
    - webkit2png to extract an image of the web page, sometimes with options
    - mogrify to trim the image down to size
Alternatively, it is possible to extract a png image of the PDF file created by
webquiz.  For the full extraction specifications see the pages array below

As an added bonus, we use imagehash to store hashes for each of the extracted
image in the file webquiz_image_hashes and we flag if any image changes
substantially. In effect, this makes the images in the manual into a test
suite.

REQUIRES:
    - brew install --cask wkhtmltopdf
    - pip install imagehash
'''

import argparse
import glob
import json
import imagehash
import os
import re
import shutil
import subprocess
import sys
import time

from PIL import Image

# location of the webquiz example web pages on a development server
examplesURL = "http://localhost/WebQuiz/doc/examples"
examplesDIR = os.path.join(os.environ['HOME'], 'Code/WebQuiz/doc/examples')
os.chdir(examplesDIR)

# lambda function for running shell commands: run( command )
run  = lambda cmd: subprocess.call(cmd, shell=True)

webquiz_mode = '-qq -d'
webkit2png_mode = ''

image_hash_file   = 'webquiz_image_hashes.json'
webquiz_image_hashes = json.load(open(image_hash_file)) if os.path.isfile(image_hash_file) else {}

class Convert:
    r'''
    Convert a webquiz example file into a png image for use in the
    manual. The following parameters are accepted:
      - page     =  name of the page to be produced
      - src      = either pdf, html or ps which corresponds to the image
                   being generated starting with pdflatex, webkit2png or latex
      - page_out = output file                                         (default: file_in)
      - delay    = time to wait in second before taking the screenshot (default: 3)

      - question = a |-separated string of the form 'question:part',
                   where part is comma separated, to "guess" that these
                   parts are correct                                   (default: None)
      - Question = a |-separated list of pairs 'question:value'        (default: None)
      - js       = javascript commands                                 (default: '')
      - js_end   = final javascript commands                           (default: '')
      - width    = width of image
    The actual conversion is done by the __call__ method of the class, which then uses write_image
    '''

    def __init__(self, page, **args):
        # set some default values and then process the arguments
        defaults = dict(
            delay = 2000,
            js = '',
            js_end = '',
            page = page,
            page_out = page,
            Question = None,
            question = None,
            src = 'html',
            webquiz = '',
            width =500,
        )
        for key in defaults:
            if key in args:
                setattr(self, key, args[key])
            else:
                setattr(self, key, defaults[key])

        if not self.Question is None:
            for qval in self.Question.split('|'):
                quest = qval.split(':')
                self.js += f"document.forms['Q{quest[0]}Form'].elements[0].value='{quest[1]}';"
                if len(quest)==2: # checking is disabled by second colon: quest:value: => len=3
                    self.js += f'gotoQuestion({quest[0]});checkAnswer({quest[0]});'
                self.delay += 1000

        if not self.question is None:
            for qp in self.question.split('|'):
                quest = qp.split(':')
                for p in quest[1].split(','):
                    self.js += f"document.forms['Q{quest[0]}Form'].elements[{int(p)-1}].checked=true;"
                if len(quest)==2: # checking is disabled by second colon: quest:parts: => len=3
                    self.js += f'gotoQuestion({quest[0]});checkAnswer({quest[0]});'
                self.delay += 1000

        # add on the final bit of javascript
        self.js += self.js_end

    def __call__(self, options):
        r'''
            Expand any glob patterms and then pass to write_image to
            generate the images and clean up
        '''
        self.options = options
        pages = self.page
        for page in glob.glob(pages+'.tex'):
            self.page = page[:-4]
            if '*' in pages:
                self.page_out = page[:-4]
            self.write_image() # the actual conversion

    # dictionary of conversion methods used in self.wrie_image()
    convert = dict(
        html = 'shot_scraper',
        pdf  = 'pdf2png',
        ps   = 'ps2png'
    )

    def write_image(self):
        r'''
          Convert self.page to self.page_out.

          If `cleaning` is `True` then all unnecessary files are deleted
          once after the image is created
        '''
        global webquiz_image_hashes
        if self.options.force or self.modified():
            print(f'\nExtracting image file {self.page_out}...')
            if os.path.exists(self.page_out+'.png'):
                # remove pg file if it already exists
                os.remove(self.page_out+'.png')

            try:
                # run the quiz file through webquiz
                if not self.options.fast:
                    run(f'webquiz {self.webquiz} {webquiz_mode} {self.page}')

                getattr(self, self.convert[self.src])()
                # if the image file exists compare with the saved image hash
                if os.path.isfile(f'{self.page_out}.png'):
                    new_hash = imagehash.colorhash(Image.open(f'{self.page_out}.png'), binbits=3)
                    if self.page_out in webquiz_image_hashes:
                        if imagehash.hex_to_flathash(webquiz_image_hashes[self.page_out], hashsize=3) - new_hash > 10:
                            print(f'Bad image hash for {self.page_out}')
                    else:
                        webquiz_image_hashes[self.page_out] = str(new_hash)

            except KeyError:
                raise ValueError(f'unknown src={self.src} for {self.page}')

            if self.options.cleaning:
                for ext in ['.log', '.xml', '-[cft]*.png']:
                    for file in glob.glob(self.page_out+ext):
                        os.remove(file)

        else:
            print(f'{page.page_out} is up to date')

    def pyppeteer (self):
        '''
        TODO

        Extract and trim and image using webquiz, wkhtmltoimage and mogrify.
        Necessary since webkit2png is no oonger supported and has not been
        ported to python3. On the plus side, we can mprotant the module and
        call directly without using subprocess.

        The full list of options can be found at
        https://wkhtmltopdf.org/usage/wkhtmltopdf.txt
        '''
        cmd =  f'shot-scraper  "{examplesURL}/{self.page}.html" -o "{self.page_out}.png"'
        if self.js:
            # wrap the javascript in a promise
            cmd += f' --javascript "new Promise(takeShot=>{{ {self.js}; setTimeout(()=>{{ takeShot(); }},1500); }})"'

        if self.delay:
            cmd += f' --wait {self.delay}'

        if self.width:
            cmd += f' --width {self.width}'


        if webkit2png_mode == '--debug':
            print(f'{cmd=}')

        # run wkhtmltoimage on the webquiz file
        run(cmd)

        if os.path.exists(f'{self.page_out}.png'): # remove png file if it already exists
            run(f'mogrify -trim -gravity center {self.page_out}.png')
        else:
            print(f'makeimages error: shot-scraper failed because {self.page_out}.png does not exist')

    def shot_scraper(self):
        '''
        Extract and trim and image using webquiz, wkhtmltoimage and mogrify.
        Necessary since webkit2png is no oonger supported and has not been
        ported to python3. On the plus side, we can mprotant the module and
        call directly without using subprocess.

        The full list of options can be found at
        https://wkhtmltopdf.org/usage/wkhtmltopdf.txt
        '''
        cmd =  f'shot-scraper  "{examplesURL}/{self.page}.html" -o "{self.page_out}.png"'
        if self.js:
            # wrap the javascript in a promise
            cmd += f' --javascript "new Promise(takeShot=>{{ {self.js}; setTimeout(()=>{{ takeShot(); }},1500); }})"'

        if self.delay:
            cmd += f' --wait {self.delay}'

        if self.width:
            cmd += f' --width {self.width}'


        if webkit2png_mode == '--debug':
            print(f'{cmd=}')

        # run wkhtmltoimage on the webquiz file
        run(cmd)

        if os.path.exists(f'{self.page_out}.png'): # remove png file if it already exists
            run(f'mogrify -trim -gravity center {self.page_out}.png')
        else:
            print(f'makeimages error: shot-scraper failed because {self.page_out}.png does not exist')

    def wkhtmltoimage(self):
        '''
        Extract and trim and image using webquiz, wkhtmltoimage and mogrify.
        Necessary since webkit2png is no oonger supported and has not been
        ported to python3. On the plus side, we can mprotant the module and
        call directly without using subprocess.

        The full list of options can be found at
        https://wkhtmltopdf.org/usage/wkhtmltopdf.txt
        '''
        cmd =  f'wkhtmltoimage --enable-javascript --javascript-delay {self.delay}'
        if self.js:
            cmd += f' --run-script "{self.js}"'

        #if self.width:
        #    cmd += f' --width {self.width}'

        cmd += f' "{examplesURL}/{self.page}.html" {self.page_out}.png'

        if webkit2png_mode == '--debug':
            print(f'{cmd=}')

        # run wkhtmltoimage on the webquiz file
        run(cmd)

        if os.path.exists(f'{self.page_out}.png'): # remove png file if it already exists
            run(f'mogrify -trim -gravity center {self.page_out}.png')
        else:
            print(f'makeimages error: wkhtmltoimage failed because {self.page_out}.png does not exist')


    def webkit2png(self):
        r'''
            Extract and trim and image using webquiz, webkit2png and mogrify


            NOT USED as webkit2png has not been ported to python3`
        '''

        # extract a png image for the web page using webkit2png
        cmd = r"webkit2png {debug} --ignore-ssl-check -o {fout} {width} --delay={delay} {js} {URL}/{fin}.html".format(
            URL=examplesURL,
            debug = webkit2png_mode,
            delay=self.delay,
            fin=self.page,
            fout=self.page_out,
            js='' if self.js is None else f'--js="{self.js}"',
            width=f'-W {self.width}' if self.width!='' else '-F'
        )
        if webkit2png_mode == '--debug':
            print(cmd)
        run(cmd)
        if os.path.exists(os.path.join(examplesDIR, self.page_out+'-full.png')): # remove png file if it already exists
            shutil.move(self.page_out+'-full.png', self.page_out+'.png')
            run(f'mogrify -trim -gravity center {self.page_out}.png')
        else:
            print(f'makeimages error: webkit2png failed because {self.page_out}-full.png does not exist')

    def pdf2png(self):
        r'''
            Extract and trim an image of the pdf file using pdflatex, convert and mogrify
        '''
        run(f'pdflatex {self.page} > /dev/null')
        run(f'convert {self.page}.pdf {self.page_out}.png && mogrify -trim {self.page_out}.png')

    def ps2png(self):
        r'''
            Extract and trim an image of the pdf file using pdflatex, convert and mogrify
        '''
        run(f'latex {self.page} > /dev/null')
        run(f'dvips {self.page} > /dev/null')
        run(f'convert {self.page}.ps {self.page_out}.png && mogrify -trim {self.page_out}.png')

    def modified(self):
        r'''
        Return `True` if the modification timestamp on the source file is newer
        than the modification time on the image file.
        '''
        src_time = time.gmtime(os.path.getmtime(self.page+'.tex'))
        try:
            output_time = time.gmtime(os.path.getmtime(self.page_out+'.png'))
        except FileNotFoundError:
            return True

        return src_time > output_time

# Specify the pages to construct using the Convert class:
pages = [
    Convert("answer-complex",   Question="1:7+i|2:i+7"),
    Convert("answer-integer",   Question="1:18"),
    Convert("answer-lowercase", Question="1:long|2:LONG"),
    Convert("answer-number",    Question="1:0.75|2:3/4"),
    Convert("answer-star",      Question="1:Canberra|2:canberra"),
    Convert("answer-string",    Question="1:canberra"),
    Convert("breadcrumbs"),
    Convert("breadcrumbs",      page_out="breadcrumbs-dropdown", js='toggle_quizindex_menu();'),
    Convert("choice-multiple"),
    Convert("choice-single"),
    Convert("ctanLion"),
    Convert("discussion"),
    Convert("discussion-Qref"),
    Convert("discussion-ref"),
    Convert("display-as-image", question='1:2'),
    Convert("french",           question='1:1'),
    Convert("index-cz"),
    Convert("index-en"),
    Convert("montypython"),
    Convert("nounits"),
    Convert("onepage",          Question="1:3"),
    Convert("pst2pdf",          width=800),
    Convert("pstricks-ex",      delay=3000),
    Convert("quiz-page",        question="1:4|1:5|3:3|2:3"),
    Convert("random",           js="questionOrder=[0,4,3,2,1];", Question='1:1:', js_end="gotoQuestion(4);checkAnswer(1);"),
    Convert("simple",           page_out='simple-html', question='1:1'),
    Convert("simple",           src='pdf',  page_out='simple-pdf'),
    Convert("theme-default",    page_out="quizindex-dropdown", js='toggle_quizindex_menu();'),
    Convert("theme-*",          width=800, question="1:1,7|3:1|3:1,7|6:4", js_end='toggle_quizindex_menu();', delay=3000),
    Convert("tikz-ex"),
    Convert("timed"),
]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description = 'Python script to extract images for the webquiz manual',
                                     epilog = 'Images for all updated pages are extracted if none are specified'
    )
    parser.add_argument('images', nargs='*',type=str, default=None, help='list of one or images to extract')
    parser.add_argument('-c', '--nocleaning', dest='cleaning', action='store_false', default=True, 
                        help='do not delete all extraneous files on exit')
    parser.add_argument('-d', '--debugging', action='store_true', default=False, help='turn on debugging')
    parser.add_argument('--fast', action='store_true', default=False,
            help='generate image without first calling webquiz')
    parser.add_argument('-f', '--force', action='store_true', default=False, help='update all files without comparing timestamps')
    parser.add_argument('-l', '--list', action='store_true', default=False, help='print list of generated image files')
    parser.add_argument('-q', '--quiet', action='store_true', default=False, help='quiet output')

    args = parser.parse_args()

    # debugging mode
    if args.debugging:
        webquiz_mode = '--debugging'
        webkit2png_mode = '--debug'
        args.cleaning = False

    if args.list:
        for page in pages:
            if '*' in page.page_out:
                for img in glob.glob(page.page_out+'.png'):
                    print(img[:-4])
            else:
                print(page.page_out)
        sys.exit()

    # By default all images are generated unless one or more output
    # image file names are given on the command line. The is_good_page
    # lambda function determines whether an image should be generated
    # for the page
    if args.images == []:
        # generate all images
        is_good_page = lambda page: True
    else:
        # only generate images that match one of the specified images
        is_good_page = lambda page: any(re.search(image, page.page_out) for image in args.images)

        # remove extensions from output file names
        for page in range(len(args.images)):
            name = args.images[page]
            if '.' in name:
                args.images[page] = name[:name.index('.')]

    # run through pages and extract the corresponding images
    for page in sorted(pages, key=lambda p: p.page_out):
        if is_good_page(page):
            page(args)

    # save the possibly updated image hashes
    with open(image_hash_file,'w') as json_file:
        json.dump(webquiz_image_hashes, json_file, ensure_ascii=False, indent=2, sort_keys=True)
