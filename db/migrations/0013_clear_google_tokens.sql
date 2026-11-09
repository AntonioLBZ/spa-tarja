-- The app never calls Google after the sign-in, so none of its tokens is kept; the rows saved before the hook that nulls
-- them still hold the ones of their last sign-in
UPDATE "account" SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL;
