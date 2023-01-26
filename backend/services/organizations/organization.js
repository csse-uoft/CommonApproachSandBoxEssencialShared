const {GDBOrganizationModel, GDBOrganizationIdModel} = require("../../models/organization");
const {Server400Error} = require("../../utils");
const {GDBOutcomeModel} = require("../../models/outcome");
const {GDBDomainModel} = require("../../models/domain");
const {GDBUserAccountModel} = require("../../models/userAccount");
const {GDBIndicatorModel} = require("../../models/indicator");

/**
 * Add organization to each account in organization[usertype] 's associated property
 * @param organization
 * @param usertype
 * @param property
 */
function addOrganizations2UsersRole(organization, usertype, property) {
  organization[usertype].map(reporter => {
    if (reporter) {
      if (!reporter[property])
        reporter[property] = [];
      reporter[property].push(organization);
    }
  });
}


async function superuserCreateOrganization(req, res, next) {
  try {
    const {form, outcomeForm, indicatorForm} = req.body;
    if (!form || !outcomeForm || !indicatorForm)
      return res.status(400).json({success: false, message: 'Wrong information input'});
    if (!form.legalName)
      return res.status(400).json({success: false, message: 'Legal name is requested'});
    if (!form.ID)
      return res.status(400).json({success: false, message: 'Organization ID is requested'});
    form.hasId = GDBOrganizationIdModel({hasIdentifier: form.ID});
    // handle administrators, editors, reporters, researchers

    // firstly replace ids to the actual userAccount object
    // then add organization id to the userAccount Object
    form.administrator = await GDBUserAccountModel.findOne({_id: form.administrator});
    if (!form.administrator)
      return res.status(400).json({success: false, message: 'Administrator: No such user'});

    // firstly replace ids to the actual userAccount objects
    form.reporters = await Promise.all(form.reporters.map(reporterId => {
      return GDBUserAccountModel.findOne({_id: reporterId});
    }));
    form.editors = await Promise.all(form.editors.map(editorId => {
      return GDBUserAccountModel.findOne({_id: editorId});
    }));
    form.researchers = await Promise.all(form.researchers.map(researcherId => {
      return GDBUserAccountModel.findOne({_id: researcherId});
    }));


    const organization = GDBOrganizationModel(form);
    // below handles outcome part
    for (let i = 0; i < outcomeForm.length; i++) {
      const outcome = outcomeForm[i];
      if (!outcome.name || !outcome.description || !outcome.domain)
        return res.status(400).json({success: false, message: 'Wrong information input'});
      const domainObject = await GDBDomainModel.findOne({_id: outcome.domain});
      if (!domainObject)
        return res.status(400).json({success: false, message: 'Wrong domain id'});
      const outcomeObject = GDBOutcomeModel({
        name: outcome.name, description: outcome.description, domain: domainObject
      });
      if (!organization.hasOutcomes) {
        organization.hasOutcomes = [];
      }
      await outcomeObject.save();
      organization.hasOutcomes.push(outcomeObject);
    }

    // below handles indicator part
    for (let i = 0; i < indicatorForm.length; i++) {
      const indicator = indicatorForm[i];
      if (!indicator.name || !indicator.description)
        return res.status(400).json({success: false, message: 'Wrong information input'});
      const indicatorObject = GDBIndicatorModel(indicator);
      if (!organization.hasIndicators)
        organization.hasIndicators = [];
      await indicatorObject.save();
      organization.hasIndicators.push(indicatorObject);
    }

    await organization.save();

    // then add organization id to the userAccount Object
    if(!organization.administrator.administratorOfs)
      organization.administrator.administratorOfs = [];
    organization.administrator.administratorOfs.push(organization);
    addOrganizations2UsersRole(organization, 'reporters', 'reporterOfs');
    addOrganizations2UsersRole(organization, 'editors', 'editorOfs');
    addOrganizations2UsersRole(organization, 'researchers', 'researcherOfs');
    await organization.save();

    return res.status(200).json({success: true, message: 'Successfully create organization ' + organization.legalName});
  } catch (e) {
    next(e);
  }
}

async function superuserFetchOrganization(req, res, next) {
  try {
    const {id} = req.params;
    if (!id)
      return res.status(400).json({success: false, message: 'Organization ID is needed'});
    const organization = await GDBOrganizationModel.findOne({_id: id}, {populates: ['hasId', 'hasOutcomes', 'hasIndicators']});
    if (!organization)
      return res.status(400).json({success: false, message: 'No such organization'});
    const outcomes = organization.hasOutcomes || [];
    if (outcomes.length > 0) {
      outcomes.map(outcome => {
        outcome.domain = outcome.domain.split('_')[1];
      });
    }
    const indicators = organization.hasIndicators || [];
    organization.ID = organization.hasId?.hasIdentifier;
    if (!organization.researchers)
      organization.researchers = [];
    if (!organization.reporters)
      organization.reporters = [];
    if (!organization.editors)
      organization.editors = [];
    if (organization.administrator)
      organization.administrator = organization.administrator.split('_')[1];
    organization.researchers = organization.researchers.map(researcher => researcher.split('_')[1]);
    organization.editors = organization.editors.map(editor => editor.split('_')[1]);
    organization.reporters = organization.reporters.map(reporter => reporter.split('_')[1]);
    delete organization.hasOutcomes;
    delete organization.hasId;
    delete organization.hasIndicators;
    return res.status(200).json({success: true, organization, outcomes, indicators});
  } catch (e) {
    next(e);
  }
}

async function adminFetchOrganization(req, res, next) {
  try {
    const {id} = req.params;
    const sessionId = req.session._id;
    if (!id)
      return res.status(400).json({success: false, message: 'Organization ID is needed'});
    const organization = await GDBOrganizationModel.findOne({_id: id}, {populates: ['administrator', 'hasId', 'hasOutcomes']});
    if (!organization)
      return res.status(400).json({success: false, message: 'No such organization'});
    if (organization.administrator._id !== sessionId)
      return res.status(400).json({success: false, message: 'The user is not the admin of the organization'});
    organization.administrator = `:userAccount_${organization.administrator._id}`;
    const outcomes = organization.hasOutcomes || [];
    if (outcomes.length > 0) {
      outcomes.map(outcome => {
        outcome.domain = outcome.domain.split('_')[1];
      });
    }
    organization.ID = organization.hasId?.hasIdentifier;
    delete organization.hasOutcomes;
    delete organization.hasId;
    return res.status(200).json({success: true, organization, outcomes});
  } catch (e) {
    next(e);
  }
}

async function superuserUpdateOrganization(req, res, next) {
  try {
    const {id} = req.params;
    const {form, outcomeForm, indicatorForm} = req.body;
    if (!id)
      return res.status(400).json({success: false, message: 'Id is needed'});
    if (!form || !outcomeForm || !indicatorForm)
      return res.status(400).json({success: false, message: 'Form and outcomeForm are needed'});

    const organization = await GDBOrganizationModel.findOne({_id: id},
      {populates: ['hasId', 'hasOutcomes', 'hasIndicators', 'administrator', 'reporters', 'researchers', 'editors']});
    if (!organization)
      return res.status(400).json({success: false, message: 'No such organization'});

    if (!form.legalName)
      return res.status(400).json({success: false, message: 'Legal name is requested'});
    if (!form.ID)
      return res.status(400).json({success: false, message: 'ID is requested'});
    organization.legalName = form.legalName;
    organization.comment = form.comment;

    form.administrator = await GDBUserAccountModel.findOne({_id: form.administrator});
    if (!form.administrator)
      return res.status(400).json({success: false, message: 'Invalid administrator'});

    // update organizationAdmin if needed
    if (organization.administrator._id !== form.administrator._id){
      // then the administrator have to be updated
      // delete organization from previous user's property
      const index = organization.administrator.administratorOfs.findIndex(org => org.split('_')[1] === id);
      organization.administrator.administratorOfs.splice(index, 1);
      await organization.administrator.save();
      // add organization on current user's property
      if (!form.administrator.administratorOfs)
        form.administrator.administratorOfs = [];
      form.administrator.administratorOfs.push(organization);
      // update property of organization
      organization.administrator = form.administrator;
    }
    // organization.administrator = form.administrator;

    await Promise.all([
      updateRoles(organization, form, 'reporters', 'reporterOfs'),
      updateRoles(organization, form, 'researchers', 'researcherOfs'),
      updateRoles(organization, form, 'editors', 'editorOfs')
    ])
    // for each reporter in organization, remove the organizations from its property
    // await Promise.all(organization.reporters.map(reporter => {
    //   const index = reporter.reporterOfs.findIndex(org => org.split('_')[1] === id);
    //   reporter.reporterOfs.splice(index, 1);
    //   return reporter.save();
    // }));
    // // add the organization to every new reporters' property
    // if (form.reporters.length > 0) {
    //   form.reporters = await Promise.all(form.reporters.map(reporterId =>
    //     GDBUserAccountModel.findOne({_id: reporterId})
    //   ));
    //   await Promise.all(form.reporters.map(reporter => {
    //     if(!reporter.reporterOfs)
    //       reporter.reporterOfs = []
    //     reporter.reporterOfs.push(organization)
    //     reporter.save()
    //   }))
    //
    // }
    // organization.reporters = [...form.reporters]
    // organization.editors = form.editors;
    // organization.researchers = form.researchers;
    if (organization.hasId.hasIdentifier !== form.ID) {
      // drop previous one
      await GDBOrganizationIdModel.findOneAndDelete({_id: organization.hasId._id});
      // and add a new one
      organization.hasId = GDBOrganizationIdModel({hasIdentifier: form.ID});
    }

    // handle outcomes
    await updateOutcomes(organization, outcomeForm);
    organization.markModified(['reporters', 'researchers', 'editors']);
    await organization.save();
    return res.status(200).json({
      success: true,
      message: 'Successfully updated organization ' + organization.legalName
    });
  } catch (e) {
    next(e);
  }
};


async function updateRoles(organization, form, organizationProperty, userAccountProperty) {
  // for each reporter in organization, remove the organizations from its property
  if(!organization[organizationProperty])
    organization[organizationProperty] = [];
  await Promise.all(organization[organizationProperty].map(userAccount => {
    // if(!userAccount[userAccountProperty])
    //   userAccount[userAccountProperty] = []
    const index = userAccount[userAccountProperty].findIndex(org => org.split('_')[1] === organization._id);
    userAccount[userAccountProperty].splice(index, 1);
    return userAccount.save();
  }));
  // add the organization to every new reporters' property
  if (form[organizationProperty].length > 0) {
    form[organizationProperty] = await Promise.all(form[organizationProperty].map(userAccountId =>
      GDBUserAccountModel.findOne({_id: userAccountId})
    ));
    await Promise.all(form[organizationProperty].map(userAccount => {
      if(!userAccount[userAccountProperty])
        userAccount[userAccountProperty] = []
      userAccount[userAccountProperty].push(organization)
      userAccount.save()
    }))

  }
  organization[organizationProperty] = [...form[organizationProperty]]
}

/*
Check is theNewOutcome inside previous outcomes
if yes, update the previous outcome and return true
if no, return false
 */
async function includeThisNewOutcome(outcomes, theOutcome) {
  if (!theOutcome._id) // must be a new outcome
    return false;
  for (let outcome of outcomes) {
    if (!outcome._id) {
      throw new Server400Error('No _id in previous outcomes');
    }

    if (outcome._id === theOutcome._id) {
      outcome.name = theOutcome.name;
      outcome.description = theOutcome.description;
      if (outcome.domain.split('_')[1] !== theOutcome.domain) {
        console.log(outcome, theOutcome);
        const domainObject = await GDBDomainModel.findOne({_id: theOutcome.domain});
        if (!domainObject)
          throw new Server400Error('No such domain');
        console.log(domainObject);
        outcome.domain = domainObject;
      }
      return true;
    }

  }
  return false;
}

/*
Check is theOutcome inside new outcomes
return true if yes
 */
function includeThisPreviousOutcome(outcomes, theOutcome) {
  if (!theOutcome._id) {
    console.log(theOutcome);
    throw new Server400Error('The previous outcome does not have _id');
  }
  for (let newOutcome of outcomes) {
    if (newOutcome._id && newOutcome._id === theOutcome._id) {
      return true;
    }
  }
  return false;
};


const updateOutcomes = async (organization, outcomeForm) => {
  if (!organization.hasOutcomes)
    organization.hasOutcomes = [];
  // loop through previous outcomes, delete those not in the form
  for (let i = 0; i < organization.hasOutcomes.length; i++) {
    if (!includeThisPreviousOutcome(outcomeForm, organization.hasOutcomes[i])) {
      await GDBOutcomeModel.findOneAndDelete({_id: organization.hasOutcomes[i]._id});
      organization.hasOutcomes[i] = undefined;
    }
  }
  organization.hasOutcomes = organization.hasOutcomes.filter((outcome) => {
    return !!outcome;
  });
  // loop through new form,
  // add those not in previous outcomes to the form,
  // update those who were in previous outcomes
  const buf = [];
  for (let i = 0; i < outcomeForm.length; i++) {
    if (!await includeThisNewOutcome(organization.hasOutcomes, outcomeForm[i])) {
      // the new outcome is not in previous outcomes
      const domain = await GDBDomainModel.findOne({_id: outcomeForm[i].domain});
      if (!domain)
        return res.status(400).json({success: false, message: 'No such domain'});
      outcomeForm[i].domain = domain;
      buf.push(GDBOutcomeModel(outcomeForm[i]));
    }
  }
  organization.hasOutcomes = organization.hasOutcomes.concat(buf);
};

async function adminUpdateOrganization(req, res, next) {
  try {
    const {id} = req.params;
    const {form, outcomeForm} = req.body;

    const sessionId = req.session._id;
    if (!id)
      return res.status(400).json({success: false, message: 'Id is needed'});
    if (!form)
      return res.status(400).json({success: false, message: 'Information is needed'});

    const organization = await GDBOrganizationModel.findOne({
      _id: id,
      administrator: {_id: sessionId}
    }, {populates: ['hasId', 'hasOutcomes']});
    if (!organization)
      return res.status(400).json({success: false, message: 'No such organization'});

    // admin shouldn't be able to edit legal name and administrator
    organization.comment = form.comment;
    organization.reporters = form.reporters;
    organization.editors = form.editors;
    organization.researchers = form.researchers;

    // handle outcomes
    await updateOutcomes(organization, outcomeForm);

    await organization.save();
    return res.status(200).json({
      success: true,
      message: 'Successfully updated organization ' + organization.legalName
    });

  } catch (e) {
    next(e);
  }
}

async function superuserDeleteOrganization(req, res, next) {
  try {
    const {id} = req.params;
    if (!id)
      return res.status(400).json({success: false, message: 'Id is needed'});
    const organization = await GDBOrganizationModel.findByIdAndDelete(id);
    if (!organization)
      return res.status(400).json({success: false, message: 'No such organization'});
    return res.status(200).json({success: true, message: 'Successfully deleted ' + organization.legalName});
  } catch (e) {
    next(e);
  }
}

module.exports = {
  adminUpdateOrganization,
  superuserCreateOrganization,
  superuserFetchOrganization,
  superuserUpdateOrganization,
  superuserDeleteOrganization,
  adminFetchOrganization
};