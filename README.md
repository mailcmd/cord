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
$ mix new <app_name>
$ cd <app_name>

## Edit your mix.exs and add in deps:
## {:cord, git: "https://github.com/mailcmd/cord-framework.git"}

$ mix deps.get
$ mkdir -p config/local
$ cp deps/cord/config/config.exs config/
$ cp deps/cord/config/local.config.exs.example config/local/config.exs

## Edit config/local/config.exs
## Set modules :websocket_manager y :app_supervisor (mandatory)

$ cp -R deps/cord/lib/layout lib/layout

$ git clone https://github.com/mailcmd/cord-js.git
$ cp cord-js/cord.js lib/layout/js/
$ rm -rf cord-js
$ mkdir -p priv/www

## PUT YOUR CORD WEB SITE IN /priv/www 

$ iex -S mix 

## Good look!
```

## Doc 

Sorry, I need time to write this section... 
