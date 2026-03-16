<h1>WORK IN PROGRESS, NOT USABLE YET!</h1>

# TODO

## HTTP
- [ ] HTTP: Evaluate html files as strings to expand before send to the client
- [ ] Error 404 page 
- [ ] Automatic load of CSS files 
- [ ] Automatic load of extras JS files

## WEBSOCKET
- [ ] Websocket support and connections with client CORD side
- [ ] A protocol to send event from server to client althrough websocket

## CLIENT SIDE
- [ ] Client support for expand rows and stuff like that


# CORD

CORD is a tiny framework for web development. 

## Components

CORD server side app open a HTTP server and a WebSocket server. 

The HTTP server serve the html pages and the WebSocket server interact with the open CORD browser side to hot refresh site content.

### HTTP Server


## Directory Struct

```
lib/ 
  cord/
  www/
    js/
    css/
```
  

  
## Installation

If [available in Hex](https://hex.pm/docs/publish), the package can be installed
by adding `cord` to your list of dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:cord, "~> 0.1.0"}
  ]
end
```

Documentation can be generated with [ExDoc](https://github.com/elixir-lang/ex_doc)
and published on [HexDocs](https://hexdocs.pm). Once published, the docs can
be found at <https://hexdocs.pm/cord>.

