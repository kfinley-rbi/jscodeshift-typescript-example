import { Box } from "@rbilabs/universal-components";

const foo = {
  backgroundColor: "green",
};
export const Container = Box.withConfig({
  ...foo,
});
