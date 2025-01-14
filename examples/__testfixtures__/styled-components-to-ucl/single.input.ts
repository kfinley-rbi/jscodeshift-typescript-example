import styled from 'styled-components';

export const Box = styled.div<{secondary: boolean}>`
  width: 40;
  height: 4rem;
  top: ${p => (p.secondary ? '5vh' : '10vh')};
  flex: 1;
  padding: 12px 4px 12px 1px;
  color: ${Styles.color.grey.four};
  margin: ${primitive.$spacing2} 0;
`;
