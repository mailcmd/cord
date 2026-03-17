import Config

config :cord, :http,
       port: 8080,
       root_dir: "lib/www/",
       js_dir: "lib/www/js",
       css_dir: "lib/www/css",
       cord_plug_options: []     # These options are passed to Cord.Plug.init/1 function.

config :logger, :default_formatter,
  format: "$date $time - [$level] $message $metadata\n"

"config/local/*.exs"
|> Path.wildcard()
|> Enum.each( fn file ->
  "local/"
  |> Kernel.<>(file |> Path.basename())
  |> import_config()
end)
