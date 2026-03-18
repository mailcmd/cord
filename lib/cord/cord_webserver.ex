defmodule CORD.Webserver do
  @moduledoc """
  """

  use CORD.HTTPServer

  @config Application.compile_env!(:cord, :local_config)

  ###################################################################################
  # Index HTML
  ###################################################################################
  get "/" do
    index_file = File.read!("lib/layout/index.html")

    main_html =
      opts
      |> Keyword.fetch!(:root_dir)
      |> Kernel.<>(@config[:main_file])
      |> File.read!()
      # |> expand_html()

    bindings =
      opts
      |> Keyword.merge([main: main_html])
      |> Keyword.merge(@config)

    # TODO: manage errors in evaluation
    html = Code.eval_string("\"\"\"\n#{index_file}\n\"\"\"", bindings) |> elem(0)

    conn
    |> assign(:init_options, opts)
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  ###################################################################################
  # CORD Client JS
  ###################################################################################
  get "/cord-js" do
    cord_js = File.read!("lib/layout/js/cord.js")
    conn
    |> assign(:init_options, opts)
    |> put_resp_content_type("text/javascript")
    |> send_resp(200, cord_js)
  end

  get "/favicon.ico" do
    icon = "data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII="

    conn
    |> put_resp_content_type("image/x-icon")
    |> send_resp(200, icon)
  end

  ###################################################################################
  # Custom JSs and CSSs 
  ###################################################################################
  get "/@" <> file_name do
    try do
      content =
        Application.get_env(:cord, :http)[:root_dir]
        |> Kernel.<>("/#{file_name}")
        |> File.read!()

      type = Path.extname(file_name) == ".js" && "javascript" || "css"
      conn
      |> assign(:init_options, opts)
      |> put_resp_content_type("text/#{type}")
      |> send_resp(200, content)
    rescue
      _ ->
        conn
        |> Map.put(:request_path, file_name)
        |> call(opts)
    end
    
  end
  
end
