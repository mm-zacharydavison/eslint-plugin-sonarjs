

export default class RequestPage extends React.Component<{}, RequestPageState> {
  state = {
    openCancelDialog: false,
    related: false,
    partialCancelFailInfo: null,
    created: false,
    paymentDialogInfo: null,
    openTutorialDialog: false,
    openCancelProDialog: false,
    openSelectProDialog: false,
  }

  componentDidMount() {
    this.load().then(() => {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'location' does not exist on type 'Readon... Remove this comment to see the full error message
      const { created } = this.props.location.state || {}
      // @ts-expect-error
      const { meets, request, showTutorialDialogABTest, sendLog } = this.props
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'location' does not exist on type 'Readon... Remove this comment to see the full error message
      const query = qs.parse(this.props.location.search, {
        ignoreQueryPrefix: true,
      })
      if (created || query.login === 'line') {
        this.afterCreated()
      }
      if (
        meets?.length > 0 &&
        (isNegotiationType(request) || isReservationType(request)) &&
        !request.notAutoOpenTutorialDialog
      ) {
        if (
          showTutorialDialogABTest &&
          parseInt(getId(request)[getId(request).length - 1], 16) % 2 > 0
        ) {
          this.setState({ openTutorialDialog: true })
          sendLog(BQEventTypes.web.TUTORIAL_DIALOG, {
            bucket: 'treatment',
            request_id: getId(request),
            service_id: getId(request.service),
          })
        } else {
          // @ts-expect-error
          this.props.updateRequest(getId(request), {
            notAutoOpenTutorialDialog: true,
          })
          sendLog(BQEventTypes.web.TUTORIAL_DIALOG, {
            bucket: 'control',
            request_id: getId(request),
            service_id: getId(request.service),
          })
        }
      }
    })
  }
}