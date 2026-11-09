-- The app never calls Google after the sign-in and never shows the picture, so neither the tokens nor the address of the
-- picture is kept; the rows saved before the hook and the profile mapping still hold the ones of their sign-in
UPDATE "account" SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL;
UPDATE "user" SET "image" = NULL;
