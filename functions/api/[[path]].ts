
interface Env {
  API: {
    fetch(request: Request): Promise<Response>;
  };
}

export const onRequest = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  return env.API.fetch(request);
};
