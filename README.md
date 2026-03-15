<h1>WORK IN PROGRESS, NOT USABLE YET!</h1>

# TODO

- [ ] Error 404 page 
- [ ] HTTP: Evaluate html files as strings to expand before send to the client
- [ ] Automatic load of CSS files 
- [ ] Automatic load of extras JS files

# CORD

    CORD is a tiny framework to web development. 

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

