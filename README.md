<h1>WORK IN PROGRESS, NOT USABLE YET!</h1>

# CORD Framework

CORD-FW is a tiny elixir/js framework for web development. 

## Concepts

CORD-framework has etentially a javascript client library (CORD-js) that allow to build reactive 
web pages, i.e, changing some property of an object, automatically update the page content. 

Also has a server side component (CORD-server) developed in Elixir language that open a HTTP 
server, a WebSocket server and a EventSource script server. 

## How to install?
```bash
$ git clone https://github.com/mailcmd/cord-framework.git
$ mv cord-framework my_app_name
$ cd my_app_name
$ mkdir -p config/local
$ cp config/local.config.exs.example config/local/config.exs
$ mix deps.get
$ git clone https://github.com/mailcmd/cord-js.git
$ cp cord-js/cord.js lib/layout/js/
$ rm -rf cord-js

## PUT YOUR CORD WEB SITE IN /priv/www 
## EDIT config/local/config.exs 
## PUT YOUR APP ELIXIR MODULES IN lib/extensions/

$ iex -S mix 

## Good look!
```

## Doc 

Sorry, I need time to write this section... 