#!/bin/bash
test ! -d lib && echo "ERROR: You can not run this script from other directory than project root!!!" && exit 1

git clone https://github.com/mailcmd/cord-js.git _tmp
cp _tmp/cord.js lib/layout/js/
rm -rf ./_tmp
exit 0
