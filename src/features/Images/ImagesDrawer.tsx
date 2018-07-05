import * as React from 'react';

import { compose, path } from 'ramda';

import { StyleRulesCallback, Theme, withStyles, WithStyles } from '@material-ui/core/styles';

import Button from '@material-ui/core/Button';

import { updateImage } from 'src/services/images';
import { getLinodes } from 'src/services/linodes';

import getAPIErrorFor from 'src/utilities/getAPIErrorFor';
import scrollErrorIntoView from 'src/utilities/scrollErrorIntoView';

import ActionsPanel from 'src/components/ActionsPanel';
import Drawer from 'src/components/Drawer';
import LinodeSelect from 'src/components/LinodeSelect';
import Notice from 'src/components/Notice';
import SectionErrorBoundary from 'src/components/SectionErrorBoundary';
import TextField from 'src/components/TextField';

type ClassNames = 'root'
|  'suffix'
|  'actionPanel';

const styles: StyleRulesCallback<ClassNames> = (theme: Theme) => ({
  root: {},
  suffix: {
    fontSize: '.9rem',
    marginRight: theme.spacing.unit,
  },
  actionPanel: {
    marginTop: theme.spacing.unit * 2,
  },
});

export interface Props {
  mode: string;
  open: boolean;
  description?: string;
  imageID?: string;
  label?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface State {
  label: string;
  description: string;
  linodes: string[][];
  selectedLinode: string;
  imageID?: string;
  errors?: Linode.ApiFieldError[];
}

type CombinedProps = Props & WithStyles<ClassNames>;

export const modes = {
  CLOSED: 'closed',
  CREATING: 'create',
  RESTORING: 'restore',
  DEPLOYING: 'deploy',
  EDITING: 'edit',
};

const titleMap = {
  [modes.CLOSED]: '',
  [modes.CREATING]: 'Create an Image',
  [modes.RESTORING]: 'Restore from an Image',
  [modes.DEPLOYING]: 'Deploy a New Linode',
  [modes.EDITING]: 'Edit an Image',
};

class ImageDrawer extends React.Component<CombinedProps, State> {
  mounted: boolean = false;
  state = { 
    description: this.props.description ? this.props.description : ' ',
    label: this.props.label ? this.props.label : '',
    linodes: [],
    errors: undefined,
    selectedLinode: '',
  };

  componentDidMount() {
    this.mounted = true;
    this.updateLinodes();
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  changeSelectedLinode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ selectedLinode: e.target.value });
  }

  close = () => {
    this.setState({ description: '', label: '', errors: undefined });
    this.props.onClose();
  }

  updateLinodes() {
    /*
     * @todo: We're only getting page 1 here, what if the account has over 100
     * Linodes?
     */
    getLinodes({ page: 1 })
      .then((response) => {
        const linodeChoices = response.data.map((linode) => {
          return [`${linode.id}`, linode.label];
        });
        this.setState({ linodes: linodeChoices });
      });
  }

  onSubmit = () => {
    const { mode, onSuccess, imageID } = this.props;
    const { label, description } = this.state;

    switch (mode) {
      case modes.EDITING:
        if (!imageID) {
          return;
        }

        if (!label) {
            this.setState({
              errors: [{ field: 'label', reason: 'Label cannot be blank.' }],
            }, () => {
              scrollErrorIntoView();
            });
            return;
        }

        updateImage(imageID, label, description)
          .then(() => {
            this.close();
            onSuccess();
          })
          .catch((errorResponse) => {
            if (this.mounted) {
              this.setState({
                errors: path(['response', 'data', 'errors'], errorResponse),
              }, () => {
                scrollErrorIntoView();
              });
            }
          });
        return;
      default:
        return;
    }
  }

  setLabel = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ label: e.target.value });
  }

  setDescription = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ description: e.target.value });
  }

  render() {
    const { mode, } = this.props;
    const { label, linodes, description, selectedLinode } = this.state;

    const { errors } = this.state;

    const hasErrorFor = getAPIErrorFor({
      linode_id: 'Linode',
      config_id: 'Config',
      region: 'Region',
      size: 'Size',
      label: 'Label',
    }, errors);
    const labelError = hasErrorFor('label');
    const descriptionError = hasErrorFor('description');
    const generalError = hasErrorFor('none');

    return (
      <Drawer
        open={this.props.open}
        onClose={this.props.onClose}
        title={titleMap[mode]}
      >
        {generalError &&
          <Notice
            error
            text={generalError}
            data-qa-notice
          />
        }

        {mode === 'create' &&
        <LinodeSelect
          linodes={linodes}
          selectedLinode={selectedLinode}
          linodeError="hello"
          generalError="goodbye"
          handleChange={this.changeSelectedLinode}
        />
      
      
      }

        <TextField
          label="Label"
          required
          value={label}
          onChange={this.setLabel}
          error={Boolean(labelError)}
          errorText={labelError}
          data-qa-volume-label
        />

        <TextField
          label="Description"
          required
          multiline
          value={description}
          onChange={this.setDescription}
          error={Boolean(descriptionError)}
          errorText={descriptionError}
          data-qa-size
        />

        <ActionsPanel style={{ marginTop: 16 }}>
          <Button
            onClick={this.onSubmit}
            variant="raised"
            color="primary"
            data-qa-submit
          >
            Submit
          </Button>
          <Button
            onClick={this.close}
            variant="raised"
            color="secondary"
            className="cancel"
            data-qa-cancel
          >
            Cancel
          </Button>
        </ActionsPanel>
      </Drawer>
    );
  }
}

const styled = withStyles(styles, { withTheme: true });

export default compose<any, any, any>(
  styled,
  SectionErrorBoundary,
)(ImageDrawer);
