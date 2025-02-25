export const mock_edge_function_data = {
  project_owner_name: 'Remo Jacinto',
  project_owner_email: 'gastibarossi+1@gmail.com',
  project_owner_phone: '2635100010',
  business_name: 'Spark & Co',
  project_status: 'NEW_IDEA',
  project_description:
    "I want to create a project that allow properties owners to create their property in the platform, and send invitations to potential tenants to apply for the property. The platform should allow the owner to manage the applications and the tenants to apply for the properties. The platform should allow the owner of the property to delete the applications, reject the applications, and accept the applications. The platform should allow the tenants to apply for the properties, see the status of their applications, and see the properties that they have applied for. I'd also like to implement a digital signature service so I can fill out a lease agreement form with all the information from the tenant, owner, and the property to be rented and sign it digitally. After signing, the property will automatically be marked as rented, so no other tenant can apply for it.",
  project_requirements: ['add_product_offering', 'new_feature'],
  project_requirements_description: 'Project requirements description',
  budget: 15000,
  timeline: '6 months',
};

export const response = {
  features_description:
    'The platform requires a comprehensive set of features to facilitate seamless interaction between property owners and potential tenants. These features are essential to ensure efficient property management, application processing, and secure digital transactions. The following features are designed to address the core functionalities needed for the platform to operate effectively, providing a user-friendly experience for both property owners and tenants.',
  proposal_features: [
    {
      feature_name: 'User Registration and Authentication',
      feature_description:
        'A secure system for property owners and tenants to register and log in to the platform. This includes email verification and password recovery options.',
      feature_timeline: '2-3 weeks',
      feature_priority: 'High',
    },
    {
      feature_name: 'Property Listing Management',
      feature_description:
        'Allows property owners to create, update, and delete property listings. This feature includes uploading property images, setting rental terms, and specifying property details.',
      feature_timeline: '3-4 weeks',
      feature_priority: 'High',
    },
    {
      feature_name: 'Application Management System',
      feature_description:
        'Enables property owners to view, accept, reject, or delete tenant applications. This system should provide a dashboard for easy management of applications.',
      feature_timeline: '4-5 weeks',
      feature_priority: 'High',
    },
    {
      feature_name: 'Tenant Application Portal',
      feature_description:
        'A portal for tenants to search for properties, apply for them, and track the status of their applications. This feature should include filters for property search and a user-friendly application form.',
      feature_timeline: '3-4 weeks',
      feature_priority: 'High',
    },
    {
      feature_name: 'Digital Signature Integration',
      feature_description:
        'Integration of a digital signature service to facilitate the signing of lease agreements. This feature should automatically populate lease forms with relevant information and mark properties as rented once signed.',
      feature_timeline: '4-5 weeks',
      feature_priority: 'Medium',
    },
    {
      feature_name: 'Notification System',
      feature_description:
        'A system to notify property owners and tenants about application updates, lease agreement status, and other important events via email or in-app notifications.',
      feature_timeline: '2-3 weeks',
      feature_priority: 'Medium',
    },
    {
      feature_name: 'Property Status Management',
      feature_description:
        "Automatically updates the status of properties to 'rented' once a lease agreement is signed, preventing further applications.",
      feature_timeline: '1-2 weeks',
      feature_priority: 'Medium',
    },
    {
      feature_name: 'Admin Dashboard',
      feature_description:
        'A backend dashboard for administrators to manage users, properties, and oversee platform operations. This includes user support and data analytics features.',
      feature_timeline: '3-4 weeks',
      feature_priority: 'Low',
    },
    {
      feature_name: 'Security and Compliance',
      feature_description:
        'Implementation of security measures to protect user data and ensure compliance with relevant regulations, such as GDPR.',
      feature_timeline: 'Ongoing',
      feature_priority: 'High',
    },
  ],
};
