function assertGithubConfig(config) {
  if (!config?.token?.trim()) {
    throw new Error("GitHub token is required.");
  }

  if (!config?.filename?.trim()) {
    throw new Error("Filename is required.");
  }
}

async function githubRequest(url, config, options = {}) {
  assertGithubConfig(config);
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token.trim()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GitHub request failed with ${response.status}.`);
  }

  return response.json();
}

export async function pushSnapshotToGithubGist(config, snapshot) {
  const filename = config.filename.trim();
  const content = JSON.stringify(snapshot, null, 2);
  const payload = {
    description: "Life Console sync",
    public: false,
    files: {
      [filename]: {
        content,
      },
    },
  };

  if (config.gistId?.trim()) {
    const gist = await githubRequest(
      `https://api.github.com/gists/${config.gistId.trim()}`,
      config,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );

    return {
      gistId: gist.id,
      url: gist.html_url,
    };
  }

  const gist = await githubRequest("https://api.github.com/gists", config, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    gistId: gist.id,
    url: gist.html_url,
  };
}

export async function pullSnapshotFromGithubGist(config) {
  if (!config?.gistId?.trim()) {
    throw new Error("GitHub Gist ID is required.");
  }

  const gist = await githubRequest(
    `https://api.github.com/gists/${config.gistId.trim()}`,
    config
  );

  const targetFile =
    gist.files?.[config.filename?.trim()] ||
    Object.values(gist.files || {})[0];

  if (!targetFile?.content) {
    throw new Error("No sync file was found in the gist.");
  }

  return JSON.parse(targetFile.content);
}
