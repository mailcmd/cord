defmodule CORD.Webserver do
  @moduledoc """
  """
alias CORD.ChannelsMaster

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

    Logger.log(:notice, "[CORD][HTTP] Main index loaded")

    conn
    |> assign(:init_options, opts)
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  ###################################################################################
  # CORD Client JS and fixed content
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

  ###################################################################################
  # EventSource loop
  ###################################################################################
  get "/eventsource" do
    Logger.log(:notice, "[CORD][EventSource] Connection open")
    conn
    |> put_resp_header("X-Accel-Buffering", "no")
    |> put_resp_header("Content-Type", "text/event-stream")
    |> put_resp_header("Cache-Control", "no-cache")
    |> send_chunked(200)
    |> CORD.EventSource.loop()
    Logger.log(:notice, "[CORD][EventSource] Connection closed")
  end

  ###################################################################################
  # API REST
  ###################################################################################

  post "/push/channel:" <> channel do
    check_authorize_user(conn)

    # if not authorized the request do not reach the code below
    {:ok, body, conn} = read_body(conn)
    
    with {:ok, json} <- JSON.decode(body),
         event <- string_key_to_atom(json) do
      
      channel |> String.to_atom() |> ChannelsMaster.push_event(event)

      conn
      |> put_resp_content_type("application/json")      
      |> send_resp(200, "{\"result_ok\": true}\n")
    else
      _ ->
        conn
        |> send_resp(400, "Malformed json request!\n")
    end    
  end
  
  post "/list/channels" do
    check_authorize_user(conn)

    # if not authorized the request do not reach the code below
    conn 
    |> put_resp_content_type("application/json")
    |> send_resp(200, JSON.encode!(ChannelsMaster.list_channels()))
  end  

  ###################################################################################
  # Private tools
  ###################################################################################

  defp check_authorize_user(conn) do
    auth =
      conn.req_headers
      |> Enum.into(%{})
      |> Map.get("authorization")

    user_pass = @config[:api_user_pass]

    with {1, "Basic " <> b64} <- {1, auth},
         {2, ^user_pass} <- {2, Base.decode64!(b64)} do
      conn
      
    else      
      {1, _} ->
        conn 
        |> send_resp(401, "Error: No authorization sent!\n")

      _ ->
        conn 
        |> send_resp(403, "Error: bad user/pass!\n")
    end        
  end

  defp string_key_to_atom(map) do
    map |> Enum.map(fn {k,v} -> {String.to_atom(k), v} end) |> Enum.into(%{})
  end
  
end
