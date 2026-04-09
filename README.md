<h1>WORK IN PROGRESS, NOT USABLE YET!</h1>

# TODO


# CORD

CORD is a tiny elixir/js framework for web development. 

## Concepts

CORD-framework has etentially a javascript client library (CORD-js) that allow to build reactive 
web pages, i.e, changing some property of an object, automatically update the page content. 

Also has a server side component (CORD-server) developed in Elixir language that open a HTTP 
server, a WebSocket server and a EventSource script server. 

## How to install?
```bash
$ git clone https://github.com/mailcmd/cord-framework.git
$ cd cord-framework
$ mix deps.get

## PUT YOUR CORD WEB SITE IN /priv/www and THEN...

$ iex -S mix 
```
