import React, { useEffect, useState, useContext } from 'react';
import { Chip, Container } from "@mui/material";
import { Add as AddIcon, Check as YesIcon } from "@mui/icons-material";
import { DeleteModal, DropdownMenu, Link, Loading, DataTable } from "../shared";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from 'notistack';
import {UserContext} from "../../context";
import {deleteDomain, fetchDomains} from "../../api/domainApi";
import {reportErrorToBackend} from "../../api/errorReportApi";

export default function Domains() {
  const navigate = useNavigate();
  const {enqueueSnackbar} = useSnackbar();

  const userContext = useContext(UserContext);
  const [state, setState] = useState({
    loading: true,
    data: [],
    selectedId: null,
    deleteDialogTitle: '',
    showDeleteDialog: false,
  });
  const [trigger, setTrigger] = useState(true);

  useEffect(() => {
    fetchDomains().then(res => {
      if(res.success)
        setState(state => ({...state, loading: false, data: res.domains}));
    }).catch(e => {
      setState(state => ({...state, loading: false}))
      navigate('/dashboard');
      enqueueSnackbar(e.json?.message || "Error occur", {variant: 'error'});
    });
  }, [trigger]);

  const showDeleteDialog = (id) => {
    setState(state => ({
      ...state, selectedId: id, showDeleteDialog: true,
      deleteDialogTitle: 'Delete domain ' + id + ' ?'
    }));
  };

  const handleDelete = async (id, form) => {

    deleteDomain(id).then(({success, message})=>{
      if (success) {
        setState(state => ({
          ...state, showDeleteDialog: false,
        }));
        setTrigger(!trigger);
        enqueueSnackbar(message || "Success", {variant: 'success'})
      }
    }).catch((e)=>{
      setState(state => ({
        ...state, showDeleteDialog: false,
      }));
      reportErrorToBackend(e)
      setTrigger(!trigger);
      enqueueSnackbar(e.json?.message || "Error occur", {variant: 'error'});
    });

  };

  const columns = [
    {
      label: 'Name',
      body: ({_id, name}) => {
        return userContext.isSuperuser? <Link color to={`/domains/${_id}/edit`}>
          {name}
        </Link>:name
      },
      sortBy: ({legalName}) => legalName
    },
    {
      label: 'Description',
      body: ({description}) => {
        return description;
      }
    },

    {
      label: ' ',
      body: ({_id}) =>
        <DropdownMenu urlPrefix={'domains'} objectId={_id} hideViewOption hideDeleteOption
                      hideEditOption={!userContext.isSuperuser} handleDelete={() => showDeleteDialog(_id)}/>
    }
  ];

  if (state.loading)
    return <Loading message={`Loading domains...`}/>;

  return (
    <Container>
      <DataTable
        title={"Domains"}
        data={state.data}
        columns={columns}
        idField="id"
        customToolbar={
          <Chip
            disabled={!userContext.isSuperuser}
            onClick={() => navigate('/Domains/new')}
            color="primary"
            icon={<AddIcon/>}
            label="Add new Domain"
            variant="outlined"/>
        }

      />
      <DeleteModal
        objectId={state.selectedId}
        title={state.deleteDialogTitle}
        show={state.showDeleteDialog}
        onHide={() => setState(state => ({...state, showDeleteDialog: false}))}
        delete={handleDelete}
      />
    </Container>
  );
}