import styled from 'styled-components';

import { ModalHeading } from 'components/modal';

import { ModalContent } from '../styled';

import { HEADER_TOP_PADDING, IMAGE_BACKGROUND_COLOR } from './checking-availability-constants';

export const Container = styled(ModalContent)`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const StyledModalHeader = styled(ModalHeading)`
  margin: 0 auto 1rem;
  font-size: 2rem;
  line-height: 2.5rem;
  font-size: 0.9375rem;
  padding-bottom: 0px;
  border-bottom: 0px;
  ${Styles.desktop`
    padding-top: 0;
  `}
`;

export const LoadingText = styled.p`
  text-align: center;
  font-size: 0.9375rem;
  line-height: 1.33;
  font-family: ${Styles.fontFamily.body};
  padding: 0.4375rem 2.5rem;
`;

export const LoadingGraphicWrapper = styled.div`
  height: 15rem;
  width: 15rem;
  border-radius: 50%;
  margin: 0 auto;
  margin-top: 16px;
  background: ${IMAGE_BACKGROUND_COLOR};
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
`;

export const GraphicTextWrapper = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
`;


export const TertiaryButton = styled.button`
  background: none;
  border: 1px solid ${Styles.color.grey.four};
  border-radius: ${Styles.borderRadius};
  color: ${Styles.color.black};
  font-family: ${Styles.fontFamily.body};
  font-size: 0.9375rem;
  padding: 0.6rem 1rem;
  width: 100%;

  &:hover {
    border-color: ${Styles.color.grey.three};
  }
`;