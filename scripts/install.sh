#!/bin/bash
test ! -d lib && echo "ERROR: You can not run this script from other directory than project root!!!" && exit 1

test -f lib/server/cord_webserver.ex && echo "WARNING: setup skipped!" && exit 0

test -f priv/cord.installed && echo "WARNING: CORD already installed!" && exit 0

echo "Running CORD setup..."

mkdir lib/layout 
cp -R deps/cord/lib/layout/* lib/layout/

mkdir -p config/local
cp -R deps/cord/config/config.exs config/config.exs
cp -R deps/cord/config/local.config.exs.example config/local/config.exs

deps/cord/scripts/update_cordjs.sh

exit 0

