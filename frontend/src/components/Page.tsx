import React from 'react'
import { Container, type ContainerProps } from '@mui/material'

export interface PageProps extends Omit<ContainerProps, 'maxWidth'> {
  maxWidth?: ContainerProps['maxWidth']
}

/** Standard page shell: width-constrained (default 'lg') + vertical padding.
 *  Forwards sx (merged) and arbitrary props (aria-*, etc.) to MUI Container. */
const Page: React.FC<PageProps> = ({ maxWidth = 'lg', sx, children, ...rest }) => (
  <Container maxWidth={maxWidth} sx={{ py: 4, ...sx }} {...rest}>
    {children}
  </Container>
)

export default Page
