import styled, { css } from "styled-components";

const foo = css`
  background: green;
`;

export const Container = styled.div`
  ${foo}
`;
