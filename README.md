# 🚀 Perplexica - An AI-powered search engine 🔎 <!-- omit in toc -->

_This is a fork of [ItzCrazyKns/Perplexica](https://github.com/ItzCrazyKns/Perplexica) with additional features and improvements._

![preview](.assets/perplexica-screenshot.png?)

## Table of Contents <!-- omit in toc -->

- [Overview](#overview)
- [Preview](#preview)
- [Features](#features)
- [Installation](#installation)
  - [Getting Started with Docker (Recommended)](#getting-started-with-docker-recommended)
  - [Non-Docker Installation](#non-docker-installation)
  - [Ollama Connection Errors](#ollama-connection-errors)
- [Using as a Search Engine](#using-as-a-search-engine)
- [Using Perplexica's API](#using-perplexicas-api)
- [Expose Perplexica to network](#expose-perplexica-to-network)
  - [Running Behind a Reverse Proxy](#running-behind-a-reverse-proxy)
- [One-Click Deployment](#one-click-deployment)
- [Upcoming Features](#upcoming-features)
- [Fork Improvements](#fork-improvements)
  - [UI Improvements](#ui-improvements)
  - [Search and Integration Enhancements](#search-and-integration-enhancements)
  - [AI Functionality](#ai-functionality)
  - [Bug Fixes](#bug-fixes)
- [Support Us](#support-us)
- [Contribution](#contribution)
- [Help and Support](#help-and-support)

## Overview

Perplexica is an open-source AI-powered searching tool or an AI-powered search engine that goes deep into the internet to find answers. Inspired by Perplexity AI, it's an open-source option that not just searches the web but understands your questions. It uses advanced machine learning algorithms like similarity searching and embeddings to refine results and provides clear answers with sources cited.

Using SearxNG to stay current and fully open source, Perplexica ensures you always get the most up-to-date information without compromising your privacy.

Want to know more about its architecture and how it works? You can read it [here](https://github.com/ItzCrazyKns/Perplexica/tree/master/docs/architecture/README.md).

## Preview

![video-preview](.assets/perplexica-preview.gif)

## Features

- **Local LLMs**: You can make use local LLMs such as Llama3 and Mixtral using Ollama.
- **Two Main Modes:**
  - **Copilot Mode:** (In development) Boosts search by generating different queries to find more relevant internet sources. Like normal search instead of just using the context by SearxNG, it visits the top matches and tries to find relevant sources to the user's query directly from the page.
  - **Normal Mode:** Processes your query and performs a web search.
- **Focus Modes:** Special modes to better answer specific types of questions. Perplexica currently has 7 focus modes:
  - **All Mode:** Searches the entire web to find the best results.
  - **Local Research Mode:** Research and interact with local files with citations.
  - **Chat Mode:** Have a truly creative conversation without web search.
  - **Academic Search Mode:** Finds articles and papers, ideal for academic research.
  - **YouTube Search Mode:** Finds YouTube videos based on the search query.
  - **Wolfram Alpha Search Mode:** Answers queries that need calculations or data analysis using Wolfram Alpha.
  - **Reddit Search Mode:** Searches Reddit for discussions and opinions related to the query.
- **Current Information:** Some search tools might give you outdated info because they use data from crawling bots and convert them into embeddings and store them in a index. Unlike them, Perplexica uses SearxNG, a metasearch engine to get the results and rerank and get the most relevant source out of it, ensuring you always get the latest information without the overhead of daily data updates.
- **API**: Integrate Perplexica into your existing applications and make use of its capibilities.

It has many more features like image and video search. Some of the planned features are mentioned in [upcoming features](#upcoming-features).

## Installation

There are mainly 2 ways of installing Perplexica - With Docker, Without Docker. Using Docker is highly recommended.

### Getting Started with Docker (Recommended)

1. Ensure Docker is installed and running on your system.
2. Clone the Perplexica repository:

   ```bash
   git clone https://github.com/ItzCrazyKns/Perplexica.git
   ```

3. After cloning, navigate to the directory containing the project files.

4. Rename the `sample.config.toml` file to `config.toml`. For Docker setups, you need only fill in the following fields:
   - `OPENAI`: Your OpenAI API key. **You only need to fill this if you wish to use OpenAI's models**.
   - `OLLAMA`: Your Ollama API URL. You should enter it as `http://host.docker.internal:PORT_NUMBER`. If you installed Ollama on port 11434, use `http://host.docker.internal:11434`. For other ports, adjust accordingly. **You need to fill this if you wish to use Ollama's models instead of OpenAI's**.
   - `GROQ`: Your Groq API key. **You only need to fill this if you wish to use Groq's hosted models**.
   - `OPENROUTER`: Your OpenRouter API key. **You only need to fill this if you wish to use models via OpenRouter**.
   - `ANTHROPIC`: Your Anthropic API key. **You only need to fill this if you wish to use Anthropic models**.
   - `Gemini`: Your Gemini API key. **You only need to fill this if you wish to use Google's models**.
   - `DEEPSEEK`: Your Deepseek API key. **Only needed if you want Deepseek models.**
   - `AIMLAPI`: Your AI/ML API key. **Only needed if you want to use AI/ML API models and embeddings.**

     **Note**: You can change these after starting Perplexica from the settings dialog.

   - `SIMILARITY_MEASURE`: The similarity measure to use (This is filled by default; you can leave it as is if you are unsure about it.)

5. Ensure you are in the directory containing the `docker-compose.yaml` file and execute:

   ```bash
   docker compose up -d
   ```

6. Wait a few minutes for the setup to complete. You can access Perplexica at http://localhost:3000 in your web browser.

**Note**: After the containers are built, you can start Perplexica directly from Docker without having to open a terminal.

### Non-Docker Installation

1. Install SearXNG and allow `JSON` format in the SearXNG settings.
2. Clone the repository and rename the `sample.config.toml` file to `config.toml` in the root directory. Ensure you complete all required fields in this file.
3. After populating the configuration run `npm i`.
4. Install the dependencies and then execute `npm run build`.
5. Finally, start the app by running `npm run start`

**Note**: Using Docker is recommended as it simplifies the setup process, especially for managing environment variables and dependencies.

See the [installation documentation](https://github.com/ItzCrazyKns/Perplexica/tree/master/docs/installation) for more information like updating, etc.

### Ollama Connection Errors

If you're encountering an Ollama connection error, it is likely due to the backend being unable to connect to Ollama's API. To fix this issue you can:

1. **Check your Ollama API URL:** Ensure that the API URL is correctly set in the settings menu.
2. **Update API URL Based on OS:**
   - **Windows:** Use `http://host.docker.internal:11434`
   - **Mac:** Use `http://host.docker.internal:11434`
   - **Linux:** Use `http://<private_ip_of_host>:11434`

   Adjust the port number if you're using a different one.

3. **Linux Users - Expose Ollama to Network:**
   - Inside `/etc/systemd/system/ollama.service`, you need to add `Environment="OLLAMA_HOST=0.0.0.0"`. Then restart Ollama by `systemctl restart ollama`. For more information see [Ollama docs](https://github.com/ollama/ollama/blob/main/docs/faq.md#setting-environment-variables-on-linux)

   - Ensure that the port (default is 11434) is not blocked by your firewall.

## Using as a Search Engine

If you wish to use Perplexica as an alternative to traditional search engines like Google or Bing, or if you want to add a shortcut for quick access from your browser's search bar, follow these steps:

1. Open your browser's settings.
2. Navigate to the 'Search Engines' section.
3. Add a new site search with the following URL: `http://localhost:3000/?q=%s`. Replace `localhost` with your IP address or domain name, and `3000` with the port number if Perplexica is not hosted locally.
4. Click the add button. Now, you can use Perplexica directly from your browser's search bar.

## Using Perplexica's API

Perplexica also provides an API for developers looking to integrate its powerful search engine into their own applications. You can run searches, use multiple models and get answers to your queries.

For more details, check out the full documentation [here](https://github.com/ItzCrazyKns/Perplexica/tree/master/docs/API/SEARCH.md).

## Expose Perplexica to network

Perplexica runs on Next.js and handles all API requests. It works right away on the same network and stays accessible even with port forwarding.

### Running Behind a Reverse Proxy

When running Perplexica behind a reverse proxy (like Nginx, Apache, or Traefik), follow these steps to ensure proper functionality:

1. **Configure the BASE_URL setting**:
   - In `config.toml`, set the `BASE_URL` parameter under the `[GENERAL]` section to your public-facing URL (e.g., `https://perplexica.yourdomain.com`)

2. **Ensure proper headers forwarding**:
   - Your reverse proxy should forward the following headers:
     - `X-Forwarded-Host`
     - `X-Forwarded-Proto`
     - `X-Forwarded-Port` (if using non-standard ports)

3. **Example Nginx configuration**:

   ```nginx
   server {
     listen 80;
     server_name perplexica.yourdomain.com;

     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header X-Forwarded-Host $host;
     }
   }
   ```

This ensures that OpenSearch descriptions, browser integrations, and all URLs work properly when accessing Perplexica through your reverse proxy.

## One-Click Deployment

[![Deploy to Sealos](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://usw.sealos.io/?openapp=system-template%3FtemplateName%3Dperplexica)
[![Deploy to RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploylobe.svg)](https://repocloud.io/details/?app_id=267)
[![Run on ClawCloud](https://raw.githubusercontent.com/ClawCloud/Run-Template/refs/heads/main/Run-on-ClawCloud.svg)](https://template.run.claw.cloud/?referralCode=U11MRQ8U9RM4&openapp=system-fastdeploy%3FtemplateName%3Dperplexica)

## Upcoming Features

- [x] Add settings page
- [x] Adding support for local LLMs
- [x] History Saving features
- [x] Introducing various Focus Modes
- [x] Adding API support
- [x] Adding Discover
- [ ] Finalizing Copilot Mode

## Fork Improvements

This fork adds several enhancements to the original Perplexica project:

### UI Improvements

- ✅ Tabbed interface for message results
- ✅ Added message editing capability
- ✅ Ability to select AI models directly while chatting without opening settings
- ✅ Change focus mode at any time during chat sessions
- ✅ Auto-scrolling
- ✅ Syntax highlighting for code blocks
- ✅ Display search query with the response
- ✅ Improved styling for all screen sizes
- ✅ Added model statistics showing model name and response time
- ✅ Shows progress during processing
- ✅ Secures API keys by not showing them in the UI

### Search and Integration Enhancements

- ✅ OpenSearch support with dynamic XML generation
  - Added BASE_URL config to support reverse proxy deployments
  - Added autocomplete functionality proxied to SearxNG
- ✅ Enhanced Reddit focus mode to work around SearxNG limitations
- ✅ Enhanced Balance mode that uses a headless web browser to retrieve web content and use relevant excerpts to enhance responses
- ✅ Adds Agent mode that uses the full content of web pages to answer queries and an agentic flow to intelligently answer complex queries with accuracy
  - See the [README.md](docs/architecture/README.md) in the docs architecture directory for more info
- ✅ Query-based settings override for browser search engine integration
  - Automatically applies user's saved optimization mode and AI model preferences when accessing via URL with `q` parameter
  - Enables seamless browser search bar integration with personalized settings

### AI Functionality

- ✅ True chat mode implementation (moved writing mode to local research mode)
- ✅ Enhanced system prompts for more reliable and relevant results
- ✅ Better parsing for reasoning models
- ✅ User customizable context window for Ollama models
- ✅ Toggle for automatic suggestions
- ✅ Added support for latest Anthropic models
- ✅ Adds support for multiple user-customizable system prompt enhancement and personas so you can tailor output to your needs
- ✅ **Model Visibility Management**: Server administrators can hide specific models from the user interface and API responses
  - Hide expensive models to prevent accidental usage and cost overruns
  - Remove non-functional or problematic models from user selection
  - Configurable via settings UI with collapsible provider interface for better organization
  - API support with `include_hidden` parameter for administrative access

### Bug Fixes

- ✅ Improved history rewriting

## Support Us

If you find Perplexica useful, consider giving us a star on GitHub. This helps more people discover Perplexica and supports the development of new features. Your support is greatly appreciated.

## Contribution

Perplexica is built on the idea that AI and large language models should be easy for everyone to use. If you find bugs or have ideas, please share them in via GitHub Issues. For more information on contributing to Perplexica you can read the [CONTRIBUTING.md](CONTRIBUTING.md) file to learn more about Perplexica and how you can contribute to it.

## Help and Support

If you have any questions or feedback, please feel free to reach out to us. You can create an issue on GitHub to get support or report bugs.

Thank you for exploring Perplexica, the AI-powered search engine designed to enhance your search experience. We are constantly working to improve Perplexica and expand its capabilities. We value your feedback and contributions which help us make Perplexica even better. Don't forget to check back for updates and new features!
